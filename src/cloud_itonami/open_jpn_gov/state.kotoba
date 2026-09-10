(ns cloud-itonami.open-jpn-gov.state
  "App state for the open-jpn-gov appview UI.
  Ported 1:1 from the former worker/svelte/src/routes/+page.svelte template
  shell — a single static screen describing the app surface (title / project /
  routes / bindings / source path). Single reagent atom, murakumo-studio構成."
  (:require [reagent.core :as r]))

(defonce state
  (r/atom
   {:app {:title "Open JPN Gov"
          :project "etzhayyim-project-open-jpn-gov"
          :name "etzhayyim-open-jpn-gov"
          :kind "appview"
          :route-count 0
          :routes []
          :vars []
          :xrpc? true
          :relative-path "src/cloud_itonami/open_jpn_gov/ui.cljs"}}))
