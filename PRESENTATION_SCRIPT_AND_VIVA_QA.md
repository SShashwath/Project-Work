# GeoAI-Based Land Suitability Assessment & Crop Yield Prediction System
## Project Work I — Review Presentation Script & Viva Q&A Guide
**Institution:** Department of Computer Science and Engineering, PSG College of Technology, Coimbatore  
**Project Guide:** Dr. S. Sivaranjani  
**Team Members:**
- Mridula Senthil Manickam (23Z346)
- S Shashwath (23Z362)
- C Siddharth (23Z368)
- Tanuj Sivakumar Shridevi (23Z376)

---

# PART 1: SLIDE-BY-SLIDE PRESENTATION SCRIPT (~5 to 7 Minutes)

### 📌 Slide 1: Title Slide
* **Visual:** Project Title, Student Names, Roll Numbers, Guide Name, Department.
* **Speaker Script:**
> *"A very pleasant morning to our respected guide Dr. S. Sivaranjani and the faculty review committee. We are team representing Project Work I, and our project is titled **'GeoAI Based Land Suitability Assessment and Crop Yield Prediction System'** — piloted on Coimbatore District, Tamil Nadu. I am Shashwath, and along with my team members Mridula, Siddharth, and Tanuj, we are excited to present our progress for Review 1."*

---

### 📌 Slide 2: Motivation & Problem Statement
* **Visual:** 5 Pillars (Tradition over data, Static tools, Coarse resolution, Low transparency, No integrated system).
* **Speaker Script:**
> *"Agriculture across Tamil Nadu faces a fundamental challenge: smallholder farmers still rely primarily on generational tradition or isolated NPK soil cards rather than spatial terrain and climate dynamics. 
> Existing decision frameworks like Analytical Hierarchy Process (AHP) depend on static, rigid expert weights and lack field-level adaptability. Furthermore, government advisories operate at the coarse block or district level, missing plot-to-plot variability. 
> There is currently no accessible, unified system that combines satellite imagery, digital elevation models, and soil chemistry into an interpretable, parcel-level decision engine. AgriSense bridges this exact gap."*

---

### 📌 Slide 3: Overview & Abstract
* **Visual:** 4 Core Modules (Suitability Classifier, Crop Recommender, Yield Prediction LSTM, SHAP Explainability).
* **Speaker Script:**
> *"Our project provides a comprehensive GeoAI pipeline with four interconnected engines:
> 1. **Suitability Classifier:** Categorizes agricultural parcels using FAO multi-criteria scoring.
> 2. **Crop Recommender:** Employs ensemble machine learning to suggest the top-3 viable crops for each parcel.
> 3. **Temporal LSTM Yield Regressor:** Ingests 12-month Sentinel-2 vegetation dynamics to forecast harvest yield against Coimbatore baseline targets.
> 4. **SHAP Explainability Engine:** Deconstructs feature attribution so agricultural officers and farmers know exactly *why* a crop was recommended.
> Together, this delivers a transparent, scalable decision support tool."*

---

### 📌 Slide 4: Literature Survey & Research Gap
* **Visual:** Key Papers (Scientific Reports 2023, Comm. in Soil Science & Plant Analysis 2024).
* **Speaker Script:**
> *"In our literature survey, we analyzed recent benchmarks in GeoAI. The 2023 *Scientific Reports* paper demonstrated simultaneous multi-crop land suitability from GEE remote sensing data, downscaling district labels to farm levels. However, it was limited to suitability classification without multi-temporal yield modeling.
> The 2024 Barmer district study showed strong performance with Random Forest and XGBoost on arid soils, but lacked continuous multi-spectral phenology curves.
> **Our Novelty:** We fuse static ISRIC soil properties and SRTM terrain with continuous 12-month Sentinel-2 NDVI and EVI phenology curves using a recurrent LSTM, combined with local FAO agronomic conservation thresholds."*

---

### 📌 Slide 5: Dataset & Tech Stack
* **Visual:** Dataset specifications (~3,725 plots × 10 attributes, 1 km grid) & Technology stack.
* **Speaker Script:**
> *"Our study area is Coimbatore district, clipped to administrative survey boundaries. We generated a uniform 1 km spatial grid yielding **3,725 candidate agricultural parcels**.
> For each plot, we ingested:
> - **SRTM DEM via Google Earth Engine:** Elevation, slope degrees, and aspect.
> - **Sentinel-2 Multispectral Imagery:** Cloud-free annual median NDVI and 12-month phenology sequences.
> - **ISRIC SoilGrids 250m:** Soil pH ($H_2O$), Soil Organic Carbon (SOC), Clay %, and Sand %.
> Our tech stack uses **Python, GeoPandas, Rasterio, Scikit-Learn, PyTorch/Keras, and SHAP** for modeling, backed by **FastAPI** on the backend and **React, Vite, and Leaflet GIS** on the frontend."*

---

### 📌 Slides 6–8: System Architecture & Pipeline Design
* **Visual:** High-Level Architecture, Data Flow Diagram (DFD Level 1/2), Modular Pipeline.
* **Speaker Script:**
> *"Here is our modular architecture:
> - **Module 1 (Data Pipeline):** Ingests and coordinate-aligns raster layers into an inner-joined spatial feature store.
> - **Module 2 (Suitability Engine):** Evaluates physical slope bounds and FAO composite suitability, enforcing a 50% viability gate.
> - **Module 3 (Inference Engine):** Classifies the best-fit crop and top-3 alternatives with probabilistic confidence.
> - **Module 4 (LSTM Yield Engine):** Evaluates seasonal vegetation vigor across the Southwest and Northeast monsoon windows to predict yield indices.
> - **Module 5 & 6 (Explainability & UI):** SHAP feature contributions and our responsive interactive GIS dashboard."*

---

### 📌 Slides 9–14: Stage 1 Walkthrough — Ingestion & Cleaning
* **Visual:** Step-by-step maps of Study Area, Plot Grid, Terrain Elevation/Slope, Sentinel-2 NDVI, and Soil Chemistry.
* **Speaker Script:**
> *"For Stage 1 (our First Review focus), we completed the end-to-end data pipeline:
> - We generated 3,902 initial candidate points, filtering out non-agricultural urban boundaries to retain 3,725 valid parcels.
> - SRTM DEM reveals elevations ranging from 180 meters in the eastern plains to over 1,200 meters in the Western Ghats.
> - SoilGrids reveals predominantly sandy loam and clay loam soils with pH between 5.5 and 8.5.
> - Sentinel-2 NDVI maps canopy density, peaking in the Pollachi and Anamalai belts.
> All layers were normalized, null-checked, and fused into our coordinate-aligned master dataset."*

---

### 📌 Slides 15–17: Modules 2, 3 & 4 Walkthrough
* **Visual:** Suitability, Crop Recommendation, and Yield Prediction implementations.
* **Speaker Script:**
> *"For Stage 2 and beyond, we designed:
> - **Suitability Scoring:** Normalizing slope, soil pH, SOC, and NDVI into a weighted composite score. Slopes greater than 15 degrees are flagged as non-cultivable under FAO soil conservation guidelines.
> - **Recommendation Classifier:** Trained on Coimbatore agronomic suitability across 10 target crops (Rice, Coconut, Turmeric, Sugarcane, Maize, Banana, Groundnut, Cotton, Tomato, Bhendi).
> - **Yield Prediction:** A recurrent LSTM network trained on the 12-month vegetation cycle, capturing crop phenology to output a relative yield multiplier and expected kg/ha."*

---

### 📌 Slide 18: Timeline & Current Milestone
* **Visual:** Review Roadmap (Weeks 1 to 14).
* **Speaker Script:**
> *"As planned for Review 1 (Weeks 4–6), we have successfully completed Module 1 data ingestion, spatial preprocessing, and master dataset fusion. Furthermore, we have built the complete end-to-end interactive system prototype and GIS dashboard ahead of schedule. 
> In the upcoming phase, we will fine-tune the XGBoost classifier, finalize the PyTorch LSTM weights, and integrate SHAP local waterfall plots.
> Now, we would like to present a quick live demonstration of our system in action."*

---

# PART 2: LIVE SYSTEM DEMO SCRIPT (~3 Minutes)

> *(Switch screen from PPT to your browser running `http://localhost:5173`)*

### 1. Geo-Map Exploration
* **Action:** Start on the **District Geo-Map** tab.
* **Script:**
> *"Here is the live AgriSense dashboard. We are visualizing all 3,725 land parcels across Coimbatore. 
> *(Click 🛰️ Satellite button)* — We can switch seamlessly to ESRI true-color satellite imagery to observe actual farm canopies. 
> *(Click 🏔️ Topo button)* — Or switch to topographic contour lines. 
> Notice our Taluk quick-jump chips:
> *(Click 'Pollachi')* — The camera focuses on the Pollachi coconut belt.
> *(Click 'Valparai')* — Notice in Valparai, parcels turn slate gray. Because slopes exceed 15 degrees in the Western Ghats, our engine automatically flags them as non-cultivable to prevent topsoil erosion."*

### 2. Parcel Inspection & Hand-Off
* **Action:** Click any parcel marker in Pollachi, then click **'🧪 Open in Live Recommender ↗'** inside the popup.
* **Script:**
> *"When a farmer or extension officer selects any parcel on the map, its exact coordinates and SoilGrids parameters are inspected. Clicking 'Open in Live Recommender' instantly transfers the spatial features into our live inference engine."*

### 3. Live Recommender & What-If Simulation
* **Action:** Now on **Live Recommender** tab. Point to the **USDA Soil Texture** badge and **Visual Gauges**.
* **Script:**
> *"Here in the Recommender:
> 1. Our dynamic USDA Soil Classifier automatically categorizes the parcel based on real-time Clay and Sand percentages (e.g. 'Sandy Clay Loam') with drainage guidance.
> 2. The visual pH and slope meters provide clear agronomic benchmarks.
> 3. With our live preview, when we select **'Pollachi Coconut Farm'** *(click preset)*, the model calculates 85%+ suitability, recommending **Coconut** with a predicted yield of over **13,000 nuts/ha (1.08x regional index)**.
> 4. Notice the 12-month Sentinel-2 Phenology curve below, capturing the NDVI vegetation trajectory across both the Southwest and Northeast monsoons."*

### 4. Safety Gating Demonstration
* **Action:** Click preset **'Steep Ghat Slope'** or drag the Slope slider above 18°.
* **Script:**
> *"If a user tests a steep hillside, the system immediately flags **'Parcel Not Cultivable'**, explicitly explaining that slopes exceeding 15° create severe erosion hazards under FAO standards. Furthermore, our Yield Diagnostic panel explains why yield modeling is gated, while offering a simulation option for alternative crops."*

### 5. Printable Farmer Advisory Sheet
* **Action:** Click preset **'Pollachi Coconut Farm'**, then click **'📄 Farmer Advisory Sheet'**.
* **Script:**
> *"Finally, for practical extension field use, clicking 'Farmer Advisory Sheet' formats a comprehensive 1-page report detailing recommended crop targets, soil amendment checklists, and drainage strategies. Clicking print outputs a clean document with zero UI clutter."*

---

# PART 3: REVIEW COMMITTEE VIVA Q&A (20+ KEY QUESTIONS)

### Category A: Geospatial & Remote Sensing

#### Q1: Why did you choose a 1 km grid resolution instead of 100 meters?
> **Answer:** *"Coimbatore district covers approximately $4,723\text{ km}^2$. A 1 km regular lattice produces 3,725 candidate points, which provides an optimal balance between micro-climatic spatial resolution and computational feasibility for regional agricultural planning. Furthermore, global datasets like ISRIC SoilGrids operate at 250m native resolution, and downscaling to 1 km avoids synthetic oversampling while remaining granular enough to capture parcel-level soil and elevation changes across taluks."*

#### Q2: How did you extract Sentinel-2 NDVI and eliminate cloud cover?
> **Answer:** *"We used Google Earth Engine to query the `COPERNICUS/S2_SR_HARMONIZED` surface reflectance collection. We applied the Sentinel-2 `QA60` bitmask band to filter out both opaque clouds and cirrus clouds. Then, we computed an annual median composite across cloud-free pixels using the standard formula $\text{NDVI} = \frac{\text{B8} - \text{B4}}{\text{B8} + \text{B4}}$ (Near-Infrared and Red bands)."*

#### Q3: What is the SRTM dataset, and how are slope and aspect derived?
> **Answer:** *"SRTM is NASA's Shuttle Radar Topography Mission providing 30-meter Digital Elevation Model (DEM) data. Slope is calculated as the maximum rate of elevation change across adjacent DEM cells (measured in degrees from 0° to 90°). Aspect is the compass direction that the downhill slope face faces (0° to 360°), which indicates solar exposure and monsoon wind intercept."*

#### Q4: Why is Aspect important in Coimbatore agriculture?
> **Answer:** *"Coimbatore is positioned adjacent to the Palghat Gap in the Western Ghats. Southwest-facing slopes receive significant rainfall and wind during the Southwest monsoon (June–September), while Northeast and East-facing slopes are sheltered and rely more on the Northeast monsoon (October–December). Aspect directly impacts moisture and microclimate."*

---

### Category B: Agronomic Science & Suitability (FAO Module 2)

#### Q5: Why do you automatically reject land parcels with slope > 15 degrees?
> **Answer:** *"Under the Food and Agriculture Organization (FAO) Framework for Land Evaluation, slopes exceeding 15° to 20° are classified as non-cultivable (Class N) for annual field crops due to severe runoff velocity, topsoil sheet erosion, and unviability of farm mechanization. In Coimbatore's Nilgiri and Anamalai foothills, cultivating annual crops on such slopes triggers landslides. Only perennial forestry or strict contour terracing is viable."*

#### Q6: How is composite suitability calculated in Module 2?
> **Answer:** *"Composite suitability is computed as a weighted multi-criteria normalized index:
> $$\text{Score} = w_{\text{slope}} \cdot S_{\text{slope}} + w_{\text{ndvi}} \cdot S_{\text{ndvi}} + w_{\text{pH}} \cdot S_{\text{pH}} + w_{\text{soc}} \cdot S_{\text{soc}}$$
> where component scores evaluate optimal ranges: soil pH between 6.0–7.5, SOC $> 300\text{ dg/kg}$, and gentle slope $< 5^\circ$. A composite score $\ge 0.70$ is classified as High suitability, $0.50 - 0.69$ as Moderate, and $< 0.50$ as Low (gated)."*

#### Q7: How does your dynamic USDA Soil Texture Classifier work?
> **Answer:** *"We take the SoilGrids Clay % and Sand % as inputs, computing Silt as $\max(0, 100 - \text{Clay} - \text{Sand})$. We then apply the standard USDA Soil Texture Triangle mathematical boundary logic. For example, soils with 20–35% clay and $>45\%$ sand are classified as 'Sandy Clay Loam'. This informs the system about drainage speed, compaction risk, and water retention capacity."*

---

### Category C: Machine Learning & Crop Recommendation (Module 3)

#### Q8: Which machine learning algorithms are used for crop recommendation?
> **Answer:** *"We employ ensemble tree classifiers—specifically Random Forest and XGBoost. Tree-based models are ideal because they handle mixed continuous environmental scales without requiring strict linear assumptions, are robust to outliers, and maintain high interpretability through feature importance."*

#### Q9: What happens if the machine learning model fails or the backend server is offline?
> **Answer:** *"We built an agronomic knowledge-base fallback engine into the architecture. If the ML inference service is unavailable, the system runs local agronomic fuzzy rules based on crop-specific requirements (e.g., Rice requiring heavy clay and flat slope; Turmeric requiring elevated, well-drained loam; Coconut requiring sandy loam). This ensures high reliability."*

#### Q10: How do you handle class imbalance across the 10 crops?
> **Answer:** *"In agricultural datasets, dominant cash crops like Coconut or Maize often outnumber niche crops like Turmeric or Bhendi. We address this using SMOTE (Synthetic Minority Over-sampling Technique) during training and stratified k-fold cross-validation to maintain consistent class distributions across splits."*

---

### Category D: Deep Learning & Temporal LSTM Yield Prediction (Module 4)

#### Q11: Why use an LSTM for yield prediction instead of standard regression (Linear/RF)?
> **Answer:** *"Crop yield is not determined by a single static snapshot. It is the cumulative result of a 12-month biological growth cycle. A field might have fertile soil, but if vegetation indices drop during flowering due to dry spells, yield drops drastically. Our PyTorch LSTM processes a temporal sequence of 12 monthly [NDVI, EVI] feature vectors, learning how vegetative growth correlates with harvest outcome across both monsoons."*

#### Q12: What is the difference between NDVI and EVI in the phenology input?
> **Answer:** *"NDVI (Normalized Difference Vegetation Index) is sensitive to chlorophyll and biomass but saturates at dense tropical canopies. EVI (Enhanced Vegetation Index) incorporates the blue band to correct for atmospheric aerosols and soil background reflections, preventing saturation in high-biomass crops like Sugarcane and Banana. Combining both gives the LSTM a balanced signal."*

#### Q13: How is the predicted yield validated?
> **Answer:** *"We compare predictions against historical multi-year crop yield averages published by the Tamil Nadu Department of Agriculture for Coimbatore district (e.g., Coconut: ~12,400 nuts/ha; Sugarcane: ~110,000 kg/ha; Maize: ~6,300 kg/ha). The model outputs both an absolute kg/ha estimate and a normalized Yield Index relative to the regional benchmark ($1.00\times$ baseline)."*

---

### Category E: Model Explainability (Module 5 — Upcoming Phase)

#### Q14: How will SHAP (SHapley Additive exPlanations) be integrated?
> **Answer:** *"SHAP uses cooperative game theory to compute the marginal contribution of each input feature to the final prediction. In our next phase, when AgriSense recommends Turmeric over Rice, SHAP waterfall plots will show the user: '+0.25 probability due to Elevation > 500m', '+0.15 due to Soil pH 6.2', and '-0.30 for Rice due to high slope'. This gives farmers and reviewers total transparency."*

---

### Category F: System Implementation & Engineering

#### Q15: How does the frontend communicate with the backend?
> **Answer:** *"The frontend communicates with our FastAPI backend on port 8001 via RESTful JSON endpoints. During development and local deployment, Vite proxies `/api` calls to FastAPI. Requests and responses are strictly validated using Pydantic schemas (`PlotInput` and `RecommendationResult`)."*

#### Q16: How does Leaflet render 3,725 points smoothly without lag?
> **Answer:** *"Instead of heavy DOM SVG markers with complex icons, we use lightweight Leaflet `CircleMarker` instances rendered directly onto the HTML5 Canvas layer with fixed coordinate arrays. We also provide marker radius controls and bounding-box focus chips (e.g. Pollachi, Sulur) so the viewport only processes active clusters."*

#### Q17: What is the unique contribution of your project over existing apps like Kisan Suvidha?
> **Answer:** *"Existing apps provide generic, block-level weather forecasts and static pesticide advisories. AgriSense provides **parcel-level GeoAI intelligence**: it integrates the specific coordinates of a farmer's plot, reads satellite vegetation dynamics and terrain slope, enforces FAO soil conservation rules, predicts yield with an LSTM, and produces a printable agronomic advisory report."*

---

# PART 4: PRESENTATION CHECKLIST BEFORE YOU START

- [ ] Ensure backend is running: `python3 run.py` (FastAPI online on port 8001).
- [ ] Ensure frontend is running: `npm run dev` (Vite running on `http://localhost:5173`).
- [ ] Open the browser tab to `http://localhost:5173` before starting the call or slide projection.
- [ ] Test the **Satellite** and **Topo** buttons once so browser cache has tile data ready.
- [ ] Test clicking **Pollachi Coconut Farm** preset to ensure instant `< 20ms` inference.
- [ ] Keep this document open on a side window/tablet as your cheat sheet!
