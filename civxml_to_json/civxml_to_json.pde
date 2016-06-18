JSONObject civ4base, civ4war, civ4bts;
XML techsXML, buildXML;
XML textXML, textObjectXML;
XML[] textList, textObjectsList;
String textObjectsXMLFilename = "civ4/XML/Text/CIV4GameTextInfos_Objects.xml";
String textXMLFilename = "civ4/XML/Text/CIV4GameTextInfos.xml";
String language = "English";

void setup() {
  civ4base = new JSONObject();
  civ4war = new JSONObject();
  civ4bts = new JSONObject();
  
  // SETUP TEXT XMLs
  
  textXML = loadXML(textXMLFilename);
  textList = textXML.getChildren("TEXT");
  
  textObjectXML = loadXML(textObjectsXMLFilename);
  textObjectsList = textObjectXML.getChildren("TEXT");
  
  
  // LOAD IN DATA
  
  getTechs("civ4/XML/Technologies/CIV4TechInfos.xml", civ4base, "base");
  getBuilds("civ4/XML/Units/CIV4BuildInfos.xml", civ4base);
  // getImprovementInfos()
  // Villages & towns produce +1 commerce (appears to be in CIV4ImprovementInfos.xml)
  
  getTechs("war/XML/Technologies/CIV4TechInfos.xml", civ4war, "war");
  getBuilds("war/XML/Units/CIV4BuildInfos.xml", civ4war);
  
  getTechs("bts/XML/Technologies/CIV4TechInfos.xml", civ4bts, "bts");
  getBuilds("bts/XML/Units/CIV4BuildInfos.xml", civ4bts);
  
  
  println(civ4bts);
  saveJSONObject(civ4base, "civ4base.json");
  saveJSONObject(civ4war, "civ4war.json");
  saveJSONObject(civ4bts, "civ4bts.json");
}

// GET TECHNOLOGY DATA
void getTechs(String path, JSONObject dataObj, String ver) {
  techsXML = loadXML(path);
  XML techInfos = techsXML.getChild("TechInfos"); 
  XML[] techInfo = techInfos.getChildren("TechInfo");
  
  JSONArray techList = new JSONArray();
  
  for (int i = 0; i < techInfo.length; i++) {
    JSONObject techDetails = new JSONObject();
    
    // id
    techDetails.setString("id", techInfo[i].getChild("Type").getContent());
    
    // Name
    for (int j = 0; j < textObjectsList.length; j++) {
      String tag = textObjectsList[j].getChild("Tag").getContent();
      if (tag.equals(techInfo[i].getChild("Description").getContent())) {
        techDetails.setString("name", textObjectsList[j].getChild(language).getContent());
      }
    }
    
    JSONArray optional = new JSONArray();
    JSONArray requires = new JSONArray();
    
    // Optional technology prerequisites
    XML[] orPreReqs = techInfo[i].getChild("OrPreReqs").getChildren("PrereqTech");
    if (orPreReqs.length > 0) {
      if (orPreReqs.length > 1) {
        for (int j = 0; j < orPreReqs.length; j++) {
          optional.append(orPreReqs[j].getContent());
        }
        techDetails.setJSONArray("optional", optional);
      } else {
        requires.append(orPreReqs[0].getContent()); // if only one option, it's required
      }
    }
    
    // Required technology prerequisites
    XML[] andPreReqs = techInfo[i].getChild("AndPreReqs").getChildren("PrereqTech");
    if (andPreReqs.length > 0) {
      for (int j = 0; j < andPreReqs.length; j++) {
        //println("AND: " + andPreReqs[j].getContent());
        requires.append(andPreReqs[j].getContent());
      }
    }
    if (requires.size() > 0) {
      techDetails.setJSONArray("requires", requires);
    }
    
    // Cost
    int cost = Integer.parseInt(techInfo[i].getChild("iCost").getContent());
    techDetails.setInt("cost", cost);
    
    JSONArray specialList = new JSONArray(); 
    
    
    // Can work water tiles
    int waterWork = Integer.parseInt(techInfo[i].getChild("bWaterWork").getContent());
    if (waterWork == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Can work water tiles");
      special.setString("id", "SPECIAL_WATER_WORK");
      specialList.append(special);
    }
    
    // Enables trade on coast/ocean
    if (techInfo[i].getChild("TerrainTrades").hasChildren()) {
      String terrainType = techInfo[i].getChild("TerrainTrades").getChild("TerrainTrade").getChild("TerrainType").getContent();
      JSONObject special = new JSONObject();
      if (terrainType.equals("TERRAIN_COAST")) {
        special.setString("name", "Enables trade on coast");
        special.setString("id", "SPECIAL_TRADE_COAST");
        specialList.append(special);
      } else if (terrainType.equals("TERRAIN_OCEAN")) {
        special.setString("name", "Enables trade on ocean");
        special.setString("id", "SPECIAL_TRADE_OCEAN");
        specialList.append(special);
      } else {
        special.setString("name", "Invalid Special!");
        special.setString("id", "INVALID");
        specialList.append(special);
      }
    }
    
    // Enables trade on rivers
    if (ver.equals("bts")) {
      int riverTrade = Integer.parseInt(techInfo[i].getChild("bRiverTrade").getContent());
      if (riverTrade == 1) {
        JSONObject special = new JSONObject();
        special.setString("name", "Enables trade on rivers");
        special.setString("id", "SPECIAL_TRADE_RIVERS");
        specialList.append(special);
      }
    }
    
    // Enables open borders trading
    int openBordersTrading = Integer.parseInt(techInfo[i].getChild("bOpenBordersTrading").getContent());
    if (openBordersTrading == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables open borders");
      special.setString("id", "SPECIAL_OPEN_BORDERS");
      specialList.append(special);
    }
    
    // Enables tech trading
    int techTrading = Integer.parseInt(techInfo[i].getChild("bTechTrading").getContent());
    if (techTrading == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables Technology Trading");
      special.setString("id", "SPECIAL_TECH_TRADING");
      specialList.append(special);
    }
    
    // Center map
    int mapCentering = Integer.parseInt(techInfo[i].getChild("bMapCentering").getContent());
    if (mapCentering == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Centers World Map");
      special.setString("id", "SPECIAL_CENTER_MAP");
      specialList.append(special);
    }
    
    // Bridge Building
    int bBridgeBuilding = Integer.parseInt(techInfo[i].getChild("bBridgeBuilding").getContent());
    if (bBridgeBuilding == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables Bridge Building");
      special.setString("id", "SPECIAL_BRIDGE_BUILDING");
      specialList.append(special);
    }
    
    // Gold trading
    int bGoldTrading = Integer.parseInt(techInfo[i].getChild("bGoldTrading").getContent());
    if (bGoldTrading == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables Gold Trading via Diplomacy");
      special.setString("id", "SPECIAL_GOLD_TRADING");
      specialList.append(special);
    }
    
    // +1 Trade Routes per City
    int iTradeRoutes = Integer.parseInt(techInfo[i].getChild("iTradeRoutes").getContent());
    if (iTradeRoutes >= 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "+1 Trade Routes per City");
      special.setString("id", "SPECIAL_TRADE_ROUTES");
      specialList.append(special);
    }
    
    // +1 Road Movement (in CIV4RouteInfos.xml, waste of time to open file for just this)
    if (techInfo[i].getChild("Type").getContent().equals("TECH_ENGINEERING")) {
      JSONObject special = new JSONObject();
      special.setString("name", "+1 Road Movement");
      special.setString("id", "SPECIAL_ROAD_MOVE");
    }
    
    // +1 Sight Across Water
    int bExtraWaterSeeFrom = Integer.parseInt(techInfo[i].getChild("bExtraWaterSeeFrom").getContent());
    if (bExtraWaterSeeFrom == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "+1 Sight Across Water");
      special.setString("id", "SPECIAL_WATER_SIGHT");
      specialList.append(special);
    }
    
    // Farms Spread Irrigation
    int bIrrigation = Integer.parseInt(techInfo[i].getChild("bIrrigation").getContent());
    if (bIrrigation == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Farms Spread Irrigation");
      special.setString("id", "SPECIAL_SPREAD_IRRIGATION");
      specialList.append(special);
    }
    
    // Enables Map Trading
    int bMapTrading = Integer.parseInt(techInfo[i].getChild("bMapTrading").getContent());
    if (bMapTrading == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables Map Trading");
      special.setString("id", "SPECIAL_MAP_TRADING");
      specialList.append(special);
    }
    
    // Enables Defensive Pacts
    int bDefensivePactTrading = Integer.parseInt(techInfo[i].getChild("bDefensivePactTrading").getContent());
    if (bDefensivePactTrading == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables Defensive Pacts");
      special.setString("id", "SPECIAL_DEFENSIVE_PACTS");
      specialList.append(special);
    }
    
    // First to Discover Receives a [unit]
    String firstFreeUnitClass = techInfo[i].getChild("FirstFreeUnitClass").getContent();
    if (firstFreeUnitClass.equals("UNITCLASS_MERCHANT")) {
      JSONObject special = new JSONObject();
      special.setString("name", "First to Discover Receives a Great Merchant");
      special.setString("id", "SPECIAL_GREAT_MERCHANT");
      specialList.append(special);
    } else if (firstFreeUnitClass.equals("UNITCLASS_SCIENTIST")) {
      JSONObject special = new JSONObject();
      special.setString("name", "First to Discover Receives a Great Scientist");
      special.setString("id", "SPECIAL_GREAT_SCIENTIST");
      specialList.append(special);
    } else if (firstFreeUnitClass.equals("UNITCLASS_ENGINEER")) {
      JSONObject special = new JSONObject();
      special.setString("name", "First to Discover Receives a Great Engineer");
      special.setString("id", "SPECIAL_GREAT_ENGINEER");
      specialList.append(special);
    } else if (firstFreeUnitClass.equals("UNITCLASS_ARTIST")) {
      JSONObject special = new JSONObject();
      special.setString("name", "First to Discover Receives a Great Artist");
      special.setString("id", "SPECIAL_GREAT_ARTIST");
      specialList.append(special);
    } else if (firstFreeUnitClass.equals("UNITCLASS_GREAT_GENERAL")) {
      JSONObject special = new JSONObject();
      special.setString("name", "First to Discover Receives a Great General");
      special.setString("id", "SPECIAL_GREAT_GENERAL");
      specialList.append(special);
    } else if (firstFreeUnitClass.equals("UNITCLASS_GREAT_SPY")) {
      JSONObject special = new JSONObject();
      special.setString("name", "First to Discover Receives a Great Spy");
      special.setString("id", "SPECIAL_GREAT_SPY");
      specialList.append(special);
    }
    
    
    
    if (specialList.size() > 0) {
      techDetails.setJSONArray("special", specialList);      
    }
    
    techList.append(techDetails);
  }
  
  dataObj.setJSONArray("technologies", techList);
}


// GET BUILD DATA
void getBuilds(String path, JSONObject dataObj) {
  buildXML = loadXML(path);
  XML buildInfos = buildXML.getChild("BuildInfos");
  XML[] buildInfo = buildInfos.getChildren("BuildInfo");
  
  JSONArray buildList = new JSONArray();
  
  for (int i = 0; i < buildInfo.length; i++) {
    JSONObject buildDetails = new JSONObject();
    
    // id
    buildDetails.setString("id", buildInfo[i].getChild("Type").getContent());
    
    // prereq tech
    buildDetails.setString("prereq", buildInfo[i].getChild("PrereqTech").getContent());
    
    // Name
    for (int j = 0; j < textObjectsList.length; j++) {
      String tag = textList[j].getChild("Tag").getContent();
      if (tag.equals(buildInfo[i].getChild("Description").getContent())) {
        String[] split = splitTokens(textList[j].getChild(language).getContent(), "[]");
        String[] trimmed = new String[2];
        trimmed[0] = trim(split[0]);
        trimmed[1] = trim(split[2]);
        buildDetails.setString("name", join(trimmed, ' '));
      }
    }
    
    buildList.append(buildDetails);
  }
  
  dataObj.setJSONArray("build", buildList);
}