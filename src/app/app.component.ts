import {AfterViewInit, Component, OnInit} from "@angular/core";
import OlMap from "ol/Map";
import TileLayer from "ol/layer/Tile";
import OlView from "ol/View";
import {Cluster, OSM} from "ol/source";
import {fromLonLat} from "ol/proj";
// @ts-ignore
import OLCesium from "ol-cesium";
import {Fill, Icon, Stroke, Style, Text} from "ol/style";
import {Feature} from "ol";
import {createEmpty, extend} from "ol/extent";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import {GeoJSON, KML} from "ol/format";
import {DragBox, Select} from "ol/interaction";
import {platformModifierKeyOnly} from "ol/events/condition";
import Geometry from "ol/geom/Geometry";
import CircleStyle from "ol/style/Circle";
// @ts-ignore
import * as ContextMenu from "ol-contextmenu/dist/ol-contextmenu.js";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})

export class AppComponent implements OnInit, AfterViewInit {

  map: OlMap = new OlMap({});
  view: OlView | undefined;
  title = "angular-openlayers";
  currentResolution = undefined;
  maxFeatureCount = 0;
  earthquakeFill = new Fill({
    color: "rgba(255, 153, 0, 0.8)",
  });
  earthquakeStroke = new Stroke({
    color: "rgba(255, 204, 0, 0.2)",
    width: 1,
  });
  textFill = new Fill({
    color: "#fff",
  });
  textStroke = new Stroke({
    color: "rgba(0, 0, 0, 0.6)",
    width: 3,
  });
  invisibleFill = new Fill({
    color: "rgba(255, 255, 255, 0.01)",
  });
  selectedFeatures: any;

  clusterData = new VectorLayer({
    source: new Cluster({
      source: new VectorSource({
        url: "assets/KML/AWOIS_Wrecks.kml",
        format: new KML()
      }),
    }),
    style: this.styleFunction.bind(this)
  });

  pointData = new VectorLayer({
    source: new VectorSource({
      url: "assets/KML/AWOIS_Wrecks.kml",
      format: new KML({
        extractStyles: false,
        showPointNames: false
      }),
    }),
    style: new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({
          color: "rgba(255, 0, 0, 1)",
        }),
      })
    })
  });

  airports = new VectorLayer({
    source: new Cluster({
      source: new VectorSource({
        url: "assets/geojson/ne_10m_airports.geojson",
        format: new GeoJSON()
      }),
    }),
    style: this.airportStyleFunction.bind(this)
  });

  populatedPlaces = new VectorLayer({
    source: new Cluster({
      source: new VectorSource({
        url: "assets/geojson/ne_50m_populated_places_simple.geojson",
        format: new GeoJSON()
      }),
    }),
    style: this.placesStyleFunction.bind(this)
  });

  countriesSource = new VectorSource({
    url: "assets/geojson/countries.geojson",
    format: new GeoJSON(),
  });

  countries = new VectorLayer({
    source: this.countriesSource
  });

  ngOnInit(): void {
    this.view = new OlView({
      center: fromLonLat([4.4024643, 51.2194475]),
      zoom: 4
    });
  }

  ngAfterViewInit(): void {
    this.pointData.set("altitudeMode", "clampToGround");
    const osmLayer = new TileLayer({
      source: new OSM()
    });
    // const bathyWMSLayer: TileLayer = new TileLayer({
    //   source: new TileWMS({
    //     url: "https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv",
    //     params: {LAYERS: "GEBCO_LATEST", TILED: true},
    //     serverType: "geoserver",
    //     transition: 0
    //   })
    // });
    // const layerSeamarks = new TileLayer({
    //   source: new XYZ({
    //     url: "http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
    //     crossOrigin: undefined
    //   })
    // });
    // const clusterData = new TileLayer({
    //   source: new TileWMS({
    //     url: "http://drive.emodnet-geology.eu:80/geoserver/wfs/kml",
    //     params: {LAYERS: "ispra:tsunami_pt_250k", TILED: true},
    //     crossOrigin: "null"
    //   }),
    //   // style: this.styleFunction
    // });
    const styleCache: any = {};
    // const clusterData2 = new TileLayer({
    //   source: new TileWMS({
    //     url: "http://geo.vliz.be:80/geoserver/Kustportaal/ows/kml",
    //     params: {LAYERS: "bathy_vliz_wrecks", TILED: true},
    //     crossOrigin: "null"
    //   }),
    // style: this.styleFunction
    // });
    this.map = new OlMap({
      target: "map",
      layers: [osmLayer, this.clusterData, this.airports, this.countries, this.populatedPlaces],
      view: this.view
    });

    const select = new Select();
    this.map.addInteraction(select);


    this.selectedFeatures = select.getFeatures();
    const dragBox = new DragBox({
      condition: platformModifierKeyOnly,
    });

    this.map.addInteraction(dragBox);

    dragBox.on("boxend", () => {
      // features that intersect the box geometry are added to the
      // collection of selected features

      // if the view is not obliquely rotated the box geometry and
      // its extent are equalivalent so intersecting features can
      // be added directly to the collection
      const rotation = this.map.getView().getRotation();
      const oblique = rotation % (Math.PI / 2) !== 0;
      const candidateFeatures = oblique ? [] : this.selectedFeatures;
      const extent = dragBox.getGeometry().getExtent();
      const countryNames: Array<string> = [];
      // @ts-ignore
      this.countriesSource.forEachFeatureIntersectingExtent(extent, (feature: Feature<Geometry>) => {
        candidateFeatures.push(feature);
        countryNames.push(feature.get("ADMIN"));
      });

      // when the view is obliquely rotated the box extent will
      // exceed its geometry so both the box and the candidate
      // feature geometries are rotated around a common anchor
      // to confirm that, with the box geometry aligned with its
      // extent, the geometries intersect
      if (oblique) {
        const anchor = [0, 0];
        const geometry = dragBox.getGeometry().clone();
        geometry.rotate(-rotation, anchor);
        const extent$1 = geometry.getExtent();
        candidateFeatures.forEach((feature: Feature) => {
          // @ts-ignore
          const geom = feature.getGeometry().clone();
          geom.rotate(-rotation, anchor);
          if (geom.intersectsExtent(extent$1)) {
            this.selectedFeatures.push(feature);
          }
        });
      }

      alert(`Selected ${countryNames.toString()}`);
    });

    dragBox.on("boxstart", () => {
      this.selectedFeatures.clear();
    });
    this.pointData.set("altitudeMode", "clampToGround");

    // const ol3d = new OLCesium({map: this.map}); // ol2dMap is the ol.Map instance
    //
    // const scene = ol3d.getCesiumScene();
    //
    // scene.terrainProvider = Cesium.createWorldTerrain({ requestVertexNormals: true });
    //
    // ol3d.setEnabled(true);

    this.addContextMenu();

  }

  addContextMenu(): void {
    const contextmenu = new ContextMenu({
      width: 170,
      defaultItems: true, // defaultItems are (for now) Zoom In/Zoom Out
      items: [
        {
          text: "Feature Information",
          classname: "some-style-class", // add some CSS rules
          callback: (e: any) => this.getFeatureInformation(e.coordinate) // `center` is your callback function
        },
        {
          text: "Add a Marker",
          classname: "some-style-class", // you can add this icon with a CSS class
                                         // instead of `icon` property (see next line)
          icon: "assets/icons/cityscape.svg",  // this can be relative or absolute
          callback: () => console.log("Marker")
        },
        "-" // this is a separator
      ]
    });
    this.map.addControl(contextmenu);
  }

  getFeatureInformation(coord: any): void {
    const pixel = this.map.getPixelFromCoordinate(coord);
    const features: any = [];
    this.map.forEachFeatureAtPixel(pixel, (feature: any) => {
      features.push(feature);
    });
    if (features.length > 0) {
      const info = [];
      let i;
      let ii;
      for (i = 0, ii = features.length; i < ii; ++i) {
        if (features[i].get("features")) {
          features[i].get("features").forEach((feat: Feature) => {
            info.push(feat.get("name"));
          });
        } else {
          info.push(features[i].get("ADMIN") ? features[i].get("ADMIN") : features[i].get("Name"));
        }
      }
      alert(info.join(", "));
      // document.getElementById("info").innerHTML = info.join(", ") || "(unknown)";
    } else {

    }
  }

  createEarthquakeStyle(feature: Feature): Style {
    // 2012_Earthquakes_Mag5.kml stores the magnitude of each earthquake in a
    // standards-violating <magnitude> tag in each Placemark.  We extract it
    // from the Placemark's name instead.
    const name = feature.get("name");
    const magnitude = parseFloat(name.substr(2));
    const radius = 5 + 20 * (magnitude - 5);

    return new Style({
      geometry: feature.getGeometry(),
      image: new Icon({
        anchor: [0.5, 0.5],
        src: "assets/icons/shipwreck.svg",
        scale: 0.05
      }),
    });
  }

  createAirportStyle(feature: Feature): Style {
    // 2012_Earthquakes_Mag5.kml stores the magnitude of each earthquake in a
    // standards-violating <magnitude> tag in each Placemark.  We extract it
    // from the Placemark's name instead.
    const name = feature.get("name");
    const magnitude = parseFloat(name.substr(2));
    const radius = 5 + 20 * (magnitude - 5);

    return new Style({
      geometry: feature.getGeometry(),
      image: new Icon({
        anchor: [0.5, 0.5],
        src: "assets/icons/airplane.svg",
        scale: 0.05
      }),
    });
  }

  createPlaceStyle(feature: Feature): Style {
    // 2012_Earthquakes_Mag5.kml stores the magnitude of each earthquake in a
    // standards-violating <magnitude> tag in each Placemark.  We extract it
    // from the Placemark's name instead.
    const name = feature.get("name");
    const magnitude = parseFloat(name.substr(2));
    const radius = 5 + 20 * (magnitude - 5);

    return new Style({
      geometry: feature.getGeometry(),
      image: new Icon({
        anchor: [0.5, 0.5],
        src: "assets/icons/cityscape.svg",
        scale: 0.05
      }),
    });
  }


  calculateClusterInfo(resolution: any): void {
    this.maxFeatureCount = 20;
    let features: any;
    if (this.clusterData) {
      // @ts-ignore
      features = this.clusterData.getSource().getFeatures();
    } else {
      features = undefined;
    }
    let feature;
    let radius;

    if (features) {
      for (let i = features.length - 1; i >= 0; --i) {
        feature = features[i];
        const originalFeatures = feature.get("features");
        const extent = createEmpty();
        let jj = 0;
        // tslint:disable-next-line:no-shadowed-variable
        for (let j = 0, jj = originalFeatures.length; j < jj; ++j) {
          extend(extent, originalFeatures[j].getGeometry().getExtent());
        }
        this.maxFeatureCount = Math.max(this.maxFeatureCount, jj);
        radius = 2 * this.maxFeatureCount;
        feature.set("radius", radius);
      }
    }
  }

  styleFunction(feature: any, resolution: any): Style {
    if (resolution !== this.currentResolution) {
      this.calculateClusterInfo(resolution);
      this.currentResolution = resolution;
    }

    let style;
    const size = feature.get("features").length;
    if (size > 1) {
      style = new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          src: "assets/icons/network.svg",
          scale: 0.05
        }),
        text: new Text({
          text: size.toString(),
          fill: this.textFill,
          stroke: this.textStroke,
        }),
      });
    } else {
      const originalFeature = feature.get("features")[0];
      style = this.createEarthquakeStyle(originalFeature);
    }
    return style;
  }

  airportStyleFunction(feature: any, resolution: any): Style {
    if (resolution !== this.currentResolution) {
      this.calculateClusterInfo(resolution);
      this.currentResolution = resolution;
    }

    let style;
    const size = feature.get("features").length;
    if (size > 1) {
      style = new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          src: "assets/icons/airport.svg",
          scale: 0.03
        }),
        text: new Text({
          text: size.toString(),
          fill: this.textFill,
          stroke: this.textStroke,
        }),
      });
    } else {
      const originalFeature = feature.get("features")[0];
      style = this.createAirportStyle(originalFeature);
    }
    return style;
  }

  placesStyleFunction(feature: any, resolution: any): Style {
    if (resolution !== this.currentResolution) {
      this.calculateClusterInfo(resolution);
      this.currentResolution = resolution;
    }

    let style;
    const size = feature.get("features").length;
    if (size > 1) {
      style = new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          src: "assets/icons/houses.svg",
          scale: 0.03
        }),
        text: new Text({
          text: size.toString(),
          fill: this.textFill,
          stroke: this.textStroke,
        }),
      });
    } else {
      const originalFeature = feature.get("features")[0];
      style = this.createPlaceStyle(originalFeature);
    }
    return style;
  }
}
