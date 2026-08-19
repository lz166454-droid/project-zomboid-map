import { Ui, loadJson } from "./shared/ui.js";
import { MapSession } from "./features/map/session/session.js";
import { ColorsFeature } from "./features/colors/colors.js";

const host = {};
host.ui = new Ui();
host.colors = new ColorsFeature(host);
host.session = new MapSession(host);

host.ui.bind();
Promise.all([
  loadJson("/api/data.json"),
  loadJson("/i18n/zh/MapLabel.json").catch(function () { return {}; }),
  loadJson("/i18n/zh/StreetName.json").catch(function () { return {}; }),
  loadJson("/i18n/zh/ui.json").catch(function () { return {}; }),
  loadJson("/i18n/en/ui.json").catch(function () { return {}; }),
  loadJson("/i18n/zh/MapSymbol.json").catch(function () { return {}; }),
  loadJson("/i18n/en/MapSymbol.json").catch(function () { return {}; }),
])
  .then(function (parts) {
    host.session.start(parts[0], parts[1], parts[2], {
      uiZh: parts[3],
      uiEn: parts[4],
      symZh: parts[5],
      symEn: parts[6],
    });
  })
  .catch(function (err) {
    document.getElementById("coords").textContent = "Failed to load: " + err;
  });
