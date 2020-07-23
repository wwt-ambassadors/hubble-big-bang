(function () {
  // The WWT ScriptInterface singleton.
  var wwt_si = null;

  // The WWT WWTControl singleton.
  var wwt_ctl = null;

  // track zoom level and length for distance calculation.
  var currgal_distance = null
  var currgal_length = null;
  var view_height_rad = null;

  // global variables to hold the wwt_si navigation for the last thumbnail clicked, for use by the reset button
  var reset_enabled = false;
  var curr_name = null;
  var curr_RA = null;
  var curr_dec = null;
  var curr_FOV = null;


  // function to start off with when $(document).ready() takes off
  function initialize() {
    // This function call is
    // wwt-web-client/HTML5SDK/wwtlib/WWTControl.cs:WWTControl::InitControlParam.
    // It creates a singleton WWTControl object, accessible here as
    // `wwtlib.WWTControl.singleton`, and returns a singleton
    // ScriptInterface object, also accessible as
    // `wwtlib.WWTControl.scriptInterface`.
    wwt_si = wwtlib.WWTControl.initControlParam(
      "wwtcanvas", // id of the <div> to draw in
      true  // use WebGL!
    );
    wwt_si.add_ready(wwt_ready);
  }

  // Execute on load of DOM
  $(document).ready(initialize);


  // If you can follow the logic above, it'll get here, and this is where the action really happens
  function wwt_ready() {
    wwt_ctl = wwtlib.WWTControl.singleton;

    wwt_si.settings.set_showConstellationBoundries(false);
    wwt_si.settings.set_showConstellationFigures(false);
    wwt_si.settings.set_showConstellationSelection(false);
    wwt_si.settings.set_showCrosshairs(false);
    setup_controls();


    // (variables defined inside a function are not known to other functions)
    loadWtml(function (folder, xml) {

      // store each of the Place objects from the WTML file in places
      var places = $(xml).find('Place');
      var descTemplate = $('<div class="obj_desc container-fluid"><div class="row"><div class="name col-xs-12 col-md-12 col-lg-12"></div><div class="what col-xs-12 col-md-12 col-lg-12"></div><div class="characteristics col-xs-12 col-md-12 col-lg-12"></div></div></div>');
      var pointTemplate = $('<div><a href="#"><div class="plot_point"></div></a></div>')


      // iterate fully through each places object
      places.each(function (i, pl) {
        var place = $(pl);

        // create a temporary object of a thumbnail and of a description element from the templates above
        var tmpdesc = descTemplate.clone();
        var tmppoint = pointTemplate.clone();


        // grab the key attributes to associate with the plot point from the wtml
        tmppoint.find('.plot_point').attr({
          title: place.find('Description').attr('Title')
        })

        // grab the top/left adjustments from wtml for where plot point should appear over sloan image
        var top = place.attr('Top');
        var left = place.attr('Left');
        tmppoint.find('.plot_point').css("top", top).css("left", left);


        // grab the class = Name/What/Characteristics html content for each Place from the WTML file
        var targetname = place.find('.Name').html();
        tmpdesc.find('.name').html(targetname);

        var targetwhat = place.find('.What').html();
        tmpdesc.find('.what').html(targetwhat);

        var targetcharacteristics = place.find('.Characteristics').html();
        tmpdesc.find('.characteristics').html(targetcharacteristics);


        // apply the unique target description class to the description template clone
        var desc_class = place.find('Target').text().toLowerCase() + "_description";
        tmpdesc.addClass(desc_class);


        // click functions - add event listener to every plot point element, which listens for single- vs. double-click
        function on_click(element, is_dblclick) {

          // ignore if wwt_si hasn't initialized yet
          if (wwt_si === null) {
            return;
          };

          // Change the border color of the selected thumbnail
          var element = element;

          // enable the reset button (and hide if visible)
          reset_enabled = true;
          $("#reset_target").fadeOut(100);

          /* hide all descriptions, reset scrolls, then show description specific to this target on sgl/dbl click */
          var toggle_class = "." + place.find('Target').text().toLowerCase() + "_description";
          $("#description_box").find(".obj_desc").hide();
          $('#description_container').scrollTop(0).show();

          $(toggle_class).show();


          // Make scroll arrow appear only for overflow
          var desc_box = $('#description_container')[0];

          if (desc_box.scrollHeight > desc_box.clientHeight) {
            $('.fa-arrow-down').show();
          } else {
            $('.fa-arrow-down').hide();
          }


          // fade in the galaxy length value if it hasn't appeared yet, and fade out the distance to galaxy value
          $("#galaxy_length_val").fadeIn(500);
          $('#distance_val').fadeOut(1000);

          /* update the current length value */
          currgal_length = place.attr("Length");


          // set the background image dataset to DSS
          wwt_si.setBackgroundImageByName('Digitized Sky Survey (Color)');

          // set the global variables: current target name / RA / dec / FOV
          curr_name = place.attr('Name');
          curr_RA = place.attr('RA');
          curr_dec = place.attr('Dec');
          curr_FOV = place.find('ImageSet').attr('FOV');

          // set the foreground image relevant to our galaxy
          wwt_si.setForegroundImageByName(place.attr('Name'));

          // send wwt viewer to our destination ra/dec
          wwt_si.gotoRaDecZoom(
            parseFloat(place.attr('RA')) * 15,
            place.attr('Dec'),
            parseFloat(place.find('ImageSet').attr('FOV')),
            is_dblclick
          );

        }

        // pop up image of galaxy spectrum, using mouseenter/mouseleave methods
        tmpdesc.find('a').mouseenter(function () {
          var popup_id = "#" + place.attr('Index').toLowerCase() + "_spectrum"
          //console.log(popup_id)
          $(popup_id).show();
        })
        tmpdesc.find('a').mouseleave(function () {
          var popup_id = "#" + place.attr('Index').toLowerCase() + "_spectrum"
          $(popup_id).hide();
        })


        // attach click events to plot points to trigger the on_click function (defined above)
        tmppoint.find('a')
          .data('foreground-image', place.attr('Name'))
          // specify different functionality for click vs. dblclick
          .on('click', function (event) {
            var element = event.target;
            on_click(element, false);
          })
          .on('dblclick', function (event) {
            var element = event.target;
            on_click(element, true)
          });


        // Plug the set of plot points into the #sloan_image_holder element
        $('#sloan_image_holder').append(tmppoint);

        // Plug the set of descriptions into the #description_container element
        $("#description_container").append(tmpdesc);


        // tag the reset button with a click action to reload the most recent thumbnail
        $("#reset_target").on('click', function (event) {

          //set the background image to DSS for any target reset
          wwt_si.setBackgroundImageByName('Digitized Sky Survey (Color)');

          wwt_si.setForegroundImageByName(curr_name);

          wwt_si.gotoRaDecZoom(
            parseFloat(curr_RA) * 15,
            curr_dec,
            parseFloat(curr_FOV),
            true
          );

          // slowly fade out reset button, because it was just clicked
          $("#reset_target").fadeOut(1000);

        })
      });
    });


    // Angular Size Calculations -- Setup timeout to monitor view parameters.
    var gal_length_el = $("#galaxy_length_val");
    var zoom_deg_el = $("#zoom_deg_val");
    var zoom_deglong_el = $("#zoom_deglong_val");
    var zoom_ddmmss_el = $("#zoom_ddmmss_val");
    var zoom_rad_el = $("#zoom_rad_val");

    // perpetually self-called timeout function
    var view_monitor = function () {
      // First order of business: schedule self to be called again in 30 ms.
      setTimeout(view_monitor, 30);

      // OK, get the view info.
      var view_cam = wwt_ctl.renderContext.viewCamera;

      // In sky mode, the zoom value is six times the viewport height, in degrees.
      var view_height_deg = view_cam.zoom / 6;

      // Update the text of the HTML elements. Some will not be visible in the interactive when they aren't necessary.
      zoom_deg_el.text(view_height_deg.toFixed(2) + "°");
      zoom_deglong_el.text(view_height_deg.toFixed(6) + "°");

      var view_height_sec = extract_degs(view_height_deg) + ":"  + extract_mins(view_height_deg) + ":" + extract_secs(view_height_deg);
      zoom_ddmmss_el.text(view_height_sec);

      view_height_rad = convert_to_rad(view_height_deg);
      zoom_rad_el.text(view_height_rad.toFixed(2) + " radians");

      gal_length_el.text(currgal_length + " mpc");
    };

    // pull out just the degrees value for DDMMSS
    var extract_degs = function (deg) {
      var degs = String(Math.floor(deg)).padStart(2, "0");
      return degs;
    };

    // pull out just the minutes value for DDMMSS
    var extract_mins = function (deg) {
      var mins = deg%1 * 60;
      mins = String(Math.round(mins)).padStart(2, "0");
      return mins;
    };

    // pull out just the seconds value for DDMMSS
    var extract_secs = function (deg) {
      var secs = (deg%1 * 60)%1 * 60;
      secs = String(Math.round(secs)).padStart(2, "0");
      return secs; 
    }

    // convert a degree value to radians
    var convert_to_rad = function (deg) {
      return (Math.PI * deg) / 180;
    };


    // Kick off the polling timer, having just set up the function above.
    setTimeout(view_monitor, 30);
  };


  // Load data from wtml file
  function loadWtml(callback) {
    var hasLoaded = false;

    //This is what Ron calls getXml
    function getWtml() {
      if (hasLoaded) { return; }
      hasLoaded = true;
      $.ajax({
        url: wtmlPath,
        crossDomain: false,
        dataType: 'xml',
        cache: false,
        success: function (xml) {
          callback(wwt_si._imageFolder, xml)
        },
        error: function (a, b, c) {
          console.log({ a: a, b: b, c: c });
        }
      });
    }

    var wtmlPath = "BUACHubbleBigBang.wtml";
    wwt_si.loadImageCollection(wtmlPath);
    console.log("Loaded Image Collection");
    getWtml();
    setTimeout(function () {
      getWtml();
    }, 1500);
    //trigger size_content function again after thumbnails have started loading
    setTimeout(function () {
      size_content();
    }, 500);
    //trigger size_content function a second time after thumbnails have started loading
    setTimeout(function () {
      size_content();
    }, 3000);
  };


  // Backend details: auto-resizing the WWT canvas.

  function size_content() {
    var container = $("html");
    var top_container = $(".top_container");
    var bottom_container = $(".bottom_container")
    var sloan_gutter = $(".sloan_gutter");

    // Constants here must be synced with settings in style.css
    const new_wwt_width = (top_container.width() - sloan_gutter.width());
    const new_wwt_height = top_container.height() - 2;
    // set wwt_canvas height to fill top_container, subtract 2 to account for border width

    const colophon_height = $("#colophon").height();
    const bottom_height = container.height() - top_container.outerHeight() - 50;
    const description_height = bottom_height - colophon_height;

    // resize wwtcanvas with new values
    $("#wwtcanvas").css({
      "width": new_wwt_width + "px",
      "height": new_wwt_height + "px"
    });

    // resize bottom container to new value
    $(bottom_container).css({
      "height": bottom_height + "px"
    })

    // resize description box to new value
    $("#description_box").css({
      "height": description_height + "px"
    });

  }

  $(document).ready(size_content);
  $(window).resize(size_content);
  // also triggering size_content function in the load_wtml function,
  // because thumbnails aren't loading immediately



  // Backend details: setting up keyboard controls.
  //
  // TODO: this code is from pywwt and was designed for use in Jupyter;
  // we might be able to do something simpler here.

  function setup_controls() {
    var canvas = document.getElementById("wwtcanvas");

    function new_event(action, attributes, deprecated) {
      if (!deprecated) {
        var event = new CustomEvent(action);
      } else {
        var event = document.createEvent("CustomEvent");
        event.initEvent(action, false, false);
      }

      if (attributes) {
        for (var attr in attributes)
          event[attr] = attributes[attr];
      }

      return event;
    }

    const wheel_up = new_event("wwt-zoom", { deltaY: 53, delta: 53 }, true);
    const wheel_down = new_event("wwt-zoom", { deltaY: -53, delta: -53 }, true);
    const mouse_left = new_event("wwt-move", { movementX: 53, movementY: 0 }, true);
    const mouse_up = new_event("wwt-move", { movementX: 0, movementY: 53 }, true);
    const mouse_right = new_event("wwt-move", { movementX: -53, movementY: 0 }, true);
    const mouse_down = new_event("wwt-move", { movementX: 0, movementY: -53 }, true);

    const zoomCodes = {
      "KeyI": wheel_up,
      "KeyO": wheel_down,
      73: wheel_up,
      79: wheel_down
    };

    const moveCodes = {
      "KeyA": mouse_left,
      "KeyW": mouse_up,
      "KeyD": mouse_right,
      "KeyS": mouse_down,
      65: mouse_left,
      87: mouse_up,
      68: mouse_right,
      83: mouse_down
    };

    window.addEventListener("keydown", function (event) {
      // "must check the deprecated keyCode property for Qt"
      if (zoomCodes.hasOwnProperty(event.code) || zoomCodes.hasOwnProperty(event.keyCode)) {
        // remove the zoom_pan instructions
        $("#zoom_pan_instrux").delay(5000).fadeOut(1000);

        var action = zoomCodes.hasOwnProperty(event.code) ? zoomCodes[event.code] : zoomCodes[event.keyCode];

        if (event.shiftKey)
          action.shiftKey = 1;
        else
          action.shiftKey = 0;

        canvas.dispatchEvent(action);
      }

      if (moveCodes.hasOwnProperty(event.code) || moveCodes.hasOwnProperty(event.keyCode)) {
        // remove the zoom_pan instructions
        $("#zoom_pan_instrux").delay(5000).fadeOut(1000);

        var action = moveCodes.hasOwnProperty(event.code) ? moveCodes[event.code] : moveCodes[event.keyCode];

        if (event.shiftKey)
          action.shiftKey = 1
        else
          action.shiftKey = 0;

        if (event.altKey)
          action.altKey = 1;
        else
          action.altKey = 0;

        canvas.dispatchEvent(action);
      }
    });

    canvas.addEventListener("wwt-move", (function (proceed) {
      return function (event) {
        if (!proceed)
          return false;

        if (event.shiftKey)
          delay = 500; // milliseconds
        else
          delay = 100;

        setTimeout(function () { proceed = true }, delay);

        if (event.altKey)
          wwt_ctl._tilt(event.movementX, event.movementY);
        else
          wwt_ctl.move(event.movementX, event.movementY);
      }
    })(true));

    canvas.addEventListener("wwt-zoom", (function (proceed) {
      return function (event) {
        if (!proceed)
          return false;

        if (event.shiftKey)
          delay = 500; // milliseconds
        else
          delay = 100;

        setTimeout(function () { proceed = true }, delay);

        if (event.deltaY < 0) {
          wwt_ctl.zoom(1.43);
        }
        else {
          wwt_ctl.zoom(0.7);
        }

      }
    })(true));
  }

  // when user scrolls to bottom of the description container, remove the down arrow icon. Add it back when scrolling back up.
  $('#description_container').on('scroll', function (event) {
    var element = event.target;

    if (element.scrollHeight - element.scrollTop === element.clientHeight) {
      $('.fa-arrow-down').fadeOut(200);
    }
    else {
      $('.fa-arrow-down').show();
    }
  })

  // may use later, in order to identify when canvas has been interacted with
  $('#wwtcanvas').on('click', function () {
    $("#zoom_pan_instrux").delay(5000).fadeOut(1000);

    if (reset_enabled) {
      $("#reset_target").show();
    }

  })

  // Distance Calculator Button (calculated on back end based on how much the screen is zoomed)
  $('#distance_button').on('click', function () {
    calculate_distance();
  })

  // the distance is calculated by dividing the length of the galaxy by the angular size in radians.
  // given that sometimes wwt is still zooming a little, "calculating..." text to delay actual calculation.
  function calculate_distance() {
    currgal_distance = currgal_length / view_height_rad;
    $('#distance_val').show();

    print_distance("calculating.");
    setTimeout(function () {
      print_distance("calculating..")
    }, 1000);
    setTimeout(function () {
      print_distance("calculating...")
    }, 2000);
    setTimeout(function () {
      print_distance(Math.round(currgal_distance) + " mpc")
    }, 3000);
  }

  // print the text parameter to the distance value element
  function print_distance(text) {
    $('#distance_val').html(text);
  }

})();