showHide = function (selector) {
  d3.select(selector).select('.hide').on('click', function () {
    d3.select(selector)
      .classed('visible', false)
      .classed('hidden', true);
  });

  d3.select(selector).select('.show').on('click', function () {
    d3.select(selector)
      .classed('visible', true)
      .classed('hidden', false);
  });
};

//obsluga drag-n-drop?
d3.json("map.json", function (data) {
  //console.log(data);
  for (var prop in data.features[0].properties) {
    console.log(prop);
    //wypelnienie dropdowna
    $("#weightSelect").append($('<option>', {value: prop})
      .text(prop));
  }
});

var selectedFuncToDrawPoints = null;

function recalcWeight(functionName, weightToRecalc) {
  var newWeight = 0;
  //potrzebna rekalibracja wag
  switch (functionName) {
    case "2x+1":
      newWeight = 2 * weightToRecalc + 0.0001;
      break;
    case "x^2":
      newWeight = weightToRecalc * weightToRecalc;
      break;
    case "sqrt(x)":
      newWeight = Math.sqrt(weightToRecalc);
      break;
    default:
      newWeight = weightToRecalc;
      break;
  }
  //wywolanie funkcji normalizujacej punkty?
  return newWeight;
}

function drawEmpty() {
  L.mapbox.accessToken = 'pk.eyJ1IjoiemV0dGVyIiwiYSI6ImVvQ3FGVlEifQ.jGp_PWb6xineYqezpSd7wA';
  map = L.mapbox.map('map', 'zetter.i73ka9hn').fitBounds([[59.355596, -9.052734], [49.894634, 3.515625]]);
  latLng = L.latLng(51.753097715746094, 19.456121921539303);
  map.setView(latLng, 13);

}


function drawMap() {
  var selectedWeight = $('#weightSelect option:selected').text();
  var selectedFunc = $('#functionSelect option:selected').text();

  selectedFuncToDrawPoints = selectedFunc;

  var funcs = {};
  funcs["2x+1"] = function(weight) { return 2 * weight + 1; };
  funcs["x^2"] = function(weight) { return weight*weight; };
  funcs["none"] = function(weight) { return 0; };
  funcs["weight"] = function(weight) { return weight; };

  var weightFunction = funcs[selectedFunc];
  if (selectedFunc === "custom") {
    funcs[selectedFunc] = function (weight) {
      return weight * weight * weight * 2;
    }
  }
  voronoiMap(map, selectedWeight, funcs[selectedFunc]);
}


voronoiMap = function (map, selectedWeight, weightFunction) {
  console.log("poczatek voronoimap");


  var pointTypes = d3.map(),
    points = [],
    lastSelectedPoint,
    filteredPoints = [],
    maxRadius = 0.00030,
    padding = 0.00002;

  var voronoi = d3.geom.voronoi()
    .x(function (d) {
      return d.x;
    })
    .y(function (d) {
      return d.y;
    });

  var selectPoint = function () {
    d3.selectAll('.selected').classed('selected', false);
    console.log("selectPoint");
    var cell = d3.select(this),
      point = cell.datum();

    lastSelectedPoint = point;
    cell.classed('selected', true);

    d3.select('#selected h1')
      .html('')
      .append('a')
      .text(point.name)
      .attr('href', point.url)
      .attr('target', '_blank')
  };

  var clone = function (obj) {
    console.log("clone");
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
  };


  var gravity = function (alpha) {
    console.log("gravity");
    return function (d) {
      d.y += (d.cy - d.y) * alpha;
      d.x += (d.cx - d.x) * alpha;
      return d;
    };
  };

  var collide = function (nodes, alpha) {
    console.log("collide");
    var quadtree = d3.geom.quadtree(nodes);
    return function (d) {
      var r = d.radius + maxRadius + padding,
        nx1 = d.x - r,
        nx2 = d.x + r,
        ny1 = d.y - r,
        ny2 = d.y + r;
      quadtree.visit(function (quad, x1, y1, x2, y2) {
        if (quad.point && (quad.point !== d)) {
          var x = d.x - quad.point.x,
            y = d.y - quad.point.y,
            l = Math.sqrt(x * x + y * y),
            r = d.radius + quad.point.radius + padding;
          if (l < r) {
            l = (l - r) / l * alpha;
            d.x -= x *= l;
            d.y -= y *= l;
            quad.point.x += x;
            quad.point.y += y;
          }
        }
        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
      });
    };
  };

  var calcWeights = function (points) {
    console.log("calcWeigths");
    var points2 = points.map(function (d) {
      return clone(d);
    });

    var c = collide(points2, .0005);
    for (var i = 0; i < 100; i++) {
      points2.forEach(function (d) {
        c(d);
      });
    }

    return points2;
  };

  var drawWithLoading = function (e) {
    console.log("drawwithloading");
    d3.select('#loading').classed('visible', true);
    if (e && e.type === 'viewreset') {
      d3.select('#voronoi').remove();
    }
    setTimeout(function () {
      draw();
      d3.select('#loading').classed('visible', false);
    }, 0);
  };


  var draw = function () {
    console.log("draw");
    d3.select('#voronoi').remove();

    var bounds = map.getBounds(),
      topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
      bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
      existing = d3.set(),
      drawLimit = bounds.pad(0.4);

    filteredPoints = calcWeights(points).filter(function (d) {
      console.log("filteredpoints");
      //var latlng = new L.LatLng(d.cx, d.cy);
      var latlng = new L.LatLng(d.x, d.y);

      if (!drawLimit.contains(latlng)) {
        return false
      }

      var point = map.latLngToLayerPoint(latlng);

      key = point.toString();
      if (existing.has(key)) {
        return false
      }
      existing.add(key);

      d.x = point.x;
      d.y = point.y;
      return true;
    });

    filteredOriginalPoints = calcWeights(points).filter(function (d) {
      console.log("filteredoriginalpoints");
      var latlng = new L.LatLng(d.cx, d.cy);

      if (!drawLimit.contains(latlng)) {
        return false
      }

      var point = map.latLngToLayerPoint(latlng);

      key = point.toString();
      if (existing.has(key)) {
        return false
      }
      existing.add(key);

      d.x = point.x;
      d.y = point.y;
      return true;
    });

    voronoi(filteredPoints).forEach(function (d) {
      d.point.cell = d;
    });

    var svg = d3.select(map.getPanes().overlayPane).append("svg")
      .attr('id', 'voronoi')
      .attr("class", "leaflet-zoom-hide")
      .style("width", map.getSize().x + 'px')
      .style("height", map.getSize().y + 'px')
      .style("margin-left", topLeft.x + "px")
      .style("margin-top", topLeft.y + "px");

    var g = svg.append("g")
      .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    var svgPoints = g.attr("class", "points")
      .selectAll("g")
      .data(filteredPoints)
      .enter().append("g")
      .attr("class", "point");

    var buildPathFromPoint = function (point) {
      return "M" + point.cell.join("L") + "Z";
    };

    svgPoints.append("path")
      .attr("class", "point-cell")
      .attr("d", buildPathFromPoint)
      .on('click', selectPoint)
      .classed("selected", function (d) {
        return lastSelectedPoint == d
      });

    /*svgPoints.append("circle")
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      })
      .style('fill', function (d) {
        return '#' + d.color
      })
      .attr("r", 3);*/

    var g2 = svg.append("g")
      .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    if(selectedFuncToDrawPoints === "none") {
      svgPoints.append("circle")
        .attr("transform", function (d) {
          return "translate(" + d.x + "," + d.y + ")";
        })
        .style('fill', function (d) {
          return '#FF0000'
        })
        .attr("r", 2);
    }

    var svgOriginalPoints = g2.attr("class", "points")
      .selectAll("g")
      .data(filteredOriginalPoints)
      .enter().append("g")
      .attr("class", "point");
    console.log("original points");
    svgOriginalPoints.append("circle")
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      })
      .style('fill', function (d) {
        return '#FF0000'
      })
      .attr("r", 2);
  };

  var mapLayer = {
    onAdd: function (map) {
      map.on('viewreset moveend', drawWithLoading);
      drawWithLoading();
    }
  };

  var normalizeWeights = function (selectedWeight, features) {
    var euclideanDistance = function (f1, f2) {
      return Math.sqrt(Math.pow((f1.geometry.coordinates[0]-f2.geometry.coordinates[0]), 2) + Math.pow((f1.geometry.coordinates[1]-f2.geometry.coordinates[1]), 2));
    };
    var minDistance = 0.0;
    var maxDistance = null;
    var minWeight = 0.0;
    var maxWeight = null;
    features.forEach(function (feature) {
      var f1 = feature;
      features.forEach(function (f2) {
        var dist = euclideanDistance(f1, f2);
        if (maxDistance == null || dist > maxDistance) {
          maxDistance = dist;
        }
      });
      var weight = f1.properties[selectedWeight];
      if (maxWeight == null || weight > maxWeight) {
        maxWeight = weight;
      }
    });


    features.forEach(function (f) {
      var weight = f.properties[selectedWeight];
      f.properties.normalizedWeight = (maxDistance - minDistance)*(weight - minWeight) / (maxWeight-minWeight) + minDistance;
    });
  };

  showHide('#about');

  console.log("wczytanie");
  d3.json("map.json", function (data) {
    nodes = data.features;

    var idx = 1;

    // normalize weights to min - max distance between geometry points
    //normalizeWeights(selectedWeight, nodes);
    //selectedWeight = "normalizedWeight";

    data.features.forEach(function (feature) {
      var radius = 10;
      if (typeof(weightFunction) !== "undefined") {
        feature.properties["calcWeight"] = weightFunction(feature.properties[selectedWeight]);
      }
    });
    normalizeWeights("calcWeight", nodes);
    selectedWeight = "normalizedWeight";
    data.features.forEach(function (feature) {
      var radius = 10;

      // if (typeof (feature.properties[selectedWeight]) !== "undefined") {
      //   radius = recalcWeight($('#functionSelect option:selected').text(), feature.properties[selectedWeight]);
      //   console.log('test');
      // }


      if (typeof(weightFunction) !== "undefined") {
        radius = feature.properties[selectedWeight];
      }
      points.push({
        id: idx,
        x: feature.geometry.coordinates[1],
        y: feature.geometry.coordinates[0],
        cx: feature.geometry.coordinates[1],
        cy: feature.geometry.coordinates[0],
        radius: radius
      });
      idx++;
    });
    map.addLayer(mapLayer);
  });
}