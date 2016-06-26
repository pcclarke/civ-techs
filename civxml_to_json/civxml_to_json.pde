JSONObject civ4base, civ4war, civ4bts;
XML techsXML, buildXML;
XML textXML, textObjectXML, textObjectWarXML, textObjectBTSXML;
XML gameTextWarXML;
XML[] textList, textObjectsList, textObjectsWarList, textObjectsBTSList;
XML[] gameTextWarList;
String textXMLFilename = "civ4/XML/Text/CIV4GameTextInfos.xml";
String textObjectsXMLFilename = "civ4/XML/Text/CIV4GameTextInfos_Objects.xml";
String textObjectsWarXMLFilename = "war/XML/Text/CIV4GameText_Warlords_Objects.xml";
String textObjectsBTSXMLFilename = "bts/XML/Text/CIV4GameText_Objects_BTS.xml";
String gameTextWarFilename = "war/XML/Text/CIV4GameText_Warlords.xml";
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
  
  textObjectWarXML = loadXML(textObjectsWarXMLFilename);
  textObjectsWarList = textObjectWarXML.getChildren("TEXT");
  
  textObjectBTSXML = loadXML(textObjectsBTSXMLFilename);
  textObjectsBTSList = textObjectBTSXML.getChildren("TEXT");
  
  gameTextWarXML = loadXML(gameTextWarFilename);
  gameTextWarList = gameTextWarXML.getChildren("TEXT");
  
  XML gameTextBTS_FixedXML = loadXML("bts/XML/Text/CIV4GameText_BTS_Fixed.xml");
  XML[] gameTextBTS_FixedList = gameTextBTS_FixedXML.getChildren("TEXT");
  
  XML[][] texts ={ 
    textObjectsList, 
    gameTextWarList, 
    textObjectsWarList, 
    textObjectsBTSList,
    gameTextBTS_FixedList };
  
  // LOAD IN DATA
  
  // Civilization 4 vanilla
  getTechs("civ4/XML/Technologies/CIV4TechInfos.xml", civ4base, "base");
  getBuilds("civ4/XML/Units/CIV4BuildInfos.xml", civ4base);
  getImprovementInfos("civ4/XML/Terrain/CIV4ImprovementInfos.xml", civ4base);
  getPromotionInfos("civ4/XML/Units/CIV4PromotionInfos.xml", civ4base);
  getReligionInfos("civ4/XML/GameInfo/CIV4ReligionInfo.xml", civ4base);
  getResourceInfos("civ4/XML/Terrain/CIV4BonusInfos.xml", civ4base);
  String civ4Civilizations = "civ4/XML/Civilizations/CIV4CivilizationInfos.xml";
  getBuildingInfos("civ4/XML/Buildings/CIV4BuildingInfos.xml", texts, civ4Civilizations, civ4base);
  
  // Civilization 4: Warlords
  getTechs("war/XML/Technologies/CIV4TechInfos.xml", civ4war, "war");
  getBuilds("war/XML/Units/CIV4BuildInfos.xml", civ4war);
  getImprovementInfos("war/XML/Terrain/CIV4ImprovementInfos.xml", civ4war);
  getPromotionInfos("war/XML/Units/CIV4PromotionInfos.xml", civ4war);
  getReligionInfos("civ4/XML/GameInfo/CIV4ReligionInfo.xml", civ4war); // civ4 dir not a typo
  getResourceInfos("war/XML/Terrain/CIV4BonusInfos.xml", civ4war);
  String warCivilizations = "war/XML/Civilizations/CIV4CivilizationInfos.xml";
  getBuildingInfos("war/XML/Buildings/CIV4BuildingInfos.xml", texts, warCivilizations, civ4war);
  
  // Civilization 4: Beyond the Sword
  getTechs("bts/XML/Technologies/CIV4TechInfos.xml", civ4bts, "bts");
  getBuilds("bts/XML/Units/CIV4BuildInfos.xml", civ4bts);
  getImprovementInfos("bts/XML/Terrain/CIV4ImprovementInfos.xml", civ4bts);
  getPromotionInfos("bts/XML/Units/CIV4PromotionInfos.xml", civ4bts);
  getReligionInfos("bts/XML/GameInfo/CIV4ReligionInfo.xml", civ4bts);
  getResourceInfos("war/XML/Terrain/CIV4BonusInfos.xml", civ4bts); // war dir not a typo
  String btsCivilizations = "bts/XML/Civilizations/CIV4CivilizationInfos.xml";
  getBuildingInfos("bts/XML/Buildings/CIV4BuildingInfos.xml", texts, btsCivilizations, civ4bts);
  
  
  //println(civ4bts);
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
    String name = "";
    for (int j = 0; j < textObjectsList.length; j++) {
      String tag = textObjectsList[j].getChild("Tag").getContent();
      if (tag.equals(techInfo[i].getChild("Description").getContent())) {
        name = textObjectsList[j].getChild(language).getContent();
      }
    }
    if (name.length() == 0) {
      for (int j = 0; j < textObjectsBTSList.length; j++) {
        String tag = textObjectsBTSList[j].getChild("Tag").getContent();
        if (tag.equals(techInfo[i].getChild("Description").getContent())) {
          name = textObjectsBTSList[j].getChild(language).getContent();
        }
      }  
    }
    techDetails.setString("name", name);
    
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
    
    // +1 Extra Moves for Water Units
    if (techInfo[i].getChild("DomainExtraMoves").hasChildren()) {
      String domainType = techInfo[i].getChild("DomainExtraMoves").getChild("DomainExtraMove").getChild("DomainType").getContent();
      int extraMoves = Integer.parseInt(techInfo[i].getChild("DomainExtraMoves").getChild("DomainExtraMove").getChild("iExtraMoves").getContent());
      JSONObject special = new JSONObject();
      if (domainType.equals("DOMAIN_SEA")) {
        special.setString("name", "+" + extraMoves + " Extra Moves for Water Units");
        special.setString("id", "SPECIAL_MOVES_SEA");
        specialList.append(special);
      }
    }
    
    // Enables trade on coast/ocean
    if (techInfo[i].getChild("TerrainTrades").hasChildren()) {
      String terrainType = techInfo[i].getChild("TerrainTrades").getChild("TerrainTrade").getChild("TerrainType").getContent();
      JSONObject special = new JSONObject();
      if (terrainType.equals("TERRAIN_COAST")) {
        special.setString("name", "Enables Trade on Coast");
        special.setString("id", "SPECIAL_TRADE_COAST");
        specialList.append(special);
      } else if (terrainType.equals("TERRAIN_OCEAN")) {
        special.setString("name", "Enables Trade on Ocean");
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
        special.setString("name", "Enables Trade on Rivers");
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
    
    // Center map
    int mapCentering = Integer.parseInt(techInfo[i].getChild("bMapCentering").getContent());
    if (mapCentering == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Centers World Map");
      special.setString("id", "SPECIAL_CENTER_MAP");
      specialList.append(special);
    }
    
    // Reveals World Map
    int revealMap = Integer.parseInt(techInfo[i].getChild("bMapVisible").getContent());
    if (revealMap == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Reveals World Map");
      special.setString("id", "SPECIAL_REVEAL_MAP");
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
    
    // +1 Health in All Cities
    int healthBonus = Integer.parseInt(techInfo[i].getChild("iHealth").getContent());
    if (healthBonus > 0) {
      JSONObject special = new JSONObject();
      special.setString("name", "+" + healthBonus + " Health in All Cities");
      special.setString("id", "SPECIAL_HEALTH_BONUS");
      specialList.append(special);
    }
    
    // +1 Happiness in All Cities
    int happyBonus = Integer.parseInt(techInfo[i].getChild("iHappiness").getContent());
    if (happyBonus > 0) {
      JSONObject special = new JSONObject();
      special.setString("name", "+" + healthBonus + " Happiness in All Cities");
      special.setString("id", "SPECIAL_HAPPINESS_BONUS");
      specialList.append(special);
    }
    
    // +1 Trade Routes per City
    int tradeRouteBonus = Integer.parseInt(techInfo[i].getChild("iTradeRoutes").getContent());
    if (tradeRouteBonus > 0) {
      JSONObject special = new JSONObject();
      special.setString("name", "+" + tradeRouteBonus + " Trade Routes per City");
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
    
    // Can Build Farms without Irrigation
    int ignoreIrr = Integer.parseInt(techInfo[i].getChild("bIgnoreIrrigation").getContent());
    if (ignoreIrr == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Can Build Farms without Irrigation");
      special.setString("id", "SPECIAL_IGNORE_IRRIGATION");
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
    
    // Enables Map Trading
    int bMapTrading = Integer.parseInt(techInfo[i].getChild("bMapTrading").getContent());
    if (bMapTrading == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables Map Trading");
      special.setString("id", "SPECIAL_MAP_TRADING");
      specialList.append(special);
    }
    
    // Enables Defensive Pacts
    int defPact = Integer.parseInt(techInfo[i].getChild("bDefensivePactTrading").getContent());
    if (defPact == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables Defensive Pacts");
      special.setString("id", "SPECIAL_DEFENSIVE_PACTS");
      specialList.append(special);
    }
    
    // Enables Permanent Alliances
    int bPermanentAllianceTrading = Integer.parseInt(techInfo[i].getChild("bPermanentAllianceTrading").getContent());
    if (bPermanentAllianceTrading == 1) {
      JSONObject special = new JSONObject();
      special.setString("name", "Enables Permanent Alliances");
      special.setString("id", "SPECIAL_PERMANENT_ALLIANCES");
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
    
    // Workers Build Improvements [value] Faster
    int iWorkerSpeedModifier = Integer.parseInt(techInfo[i].getChild("iWorkerSpeedModifier").getContent());
    if (iWorkerSpeedModifier > 0) {
      JSONObject special = new JSONObject();
      special.setString("name", "Workers Build Improvements +" + iWorkerSpeedModifier + "% Faster");
      special.setString("id", "SPECIAL_WORKER_SPEED");
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

void getImprovementInfos(String path, JSONObject dataObj) {
  XML improveXML = loadXML(path);
  XML improveInfos = improveXML.getChild("ImprovementInfos");
  XML[] improveInfo = improveInfos.getChildren("ImprovementInfo");
  
  JSONArray improveList = new JSONArray();
  
  for (int i = 0; i < improveInfo.length; i++) {    
    String id = improveInfo[i].getChild("Type").getContent();

    if (improveInfo[i].getChild("TechYieldChanges").hasChildren()) {
      XML[] techYieldChanges =  improveInfo[i].getChild("TechYieldChanges").getChildren("TechYieldChange");
      
      for (int j = 0; j < techYieldChanges.length; j++) {
        JSONObject improveDetails = new JSONObject();
        JSONObject improveSpecial = new JSONObject();
        improveSpecial.setString("id", id);
        improveDetails.setString("prereq", techYieldChanges[j].getChild("PrereqTech").getContent());
        
        XML[] techYield = techYieldChanges[j].getChild("TechYields").getChildren("iYield");
        int food = Integer.parseInt(techYield[0].getContent());
        int hammer = Integer.parseInt(techYield[1].getContent());
        int trade = Integer.parseInt(techYield[2].getContent());
        
        improveSpecial.setInt("food", food);
        improveSpecial.setInt("hammer", hammer);
        improveSpecial.setInt("trade", trade);
        
        String foodBonus = (food > 0) ? "+" + food + " Food" : "";
        String hammerBonus = (hammer > 0) ? "+" + hammer + " Hammers" : "";
        String tradeBonus = (trade > 0) ? "+" + trade + " Trade" : "";
        String improvement = "";
        
        if (id.equals("IMPROVEMENT_FARM")) {
          improvement = "Farm";
        } else if (id.equals("IMPROVEMENT_WORKSHOP")) {
          improvement = "Workshop";
        } else if (id.equals("IMPROVEMENT_WINDMILL")) {
          improvement = "Windmill";
        } else if (id.equals("IMPROVEMENT_WATERMILL")) {
          improvement = "Watermill";
        } else if (id.equals("IMPROVEMENT_VILLAGE")) {
          improvement = "Village";
        } else if (id.equals("IMPROVEMENT_TOWN")) {
          improvement = "Town";
        }
        improveSpecial.setString("name", improvement + ": " + 
          ((food > 0) ? foodBonus : "") + 
          ((hammer > 0) ? ((food > 0) ? " " : "") + hammerBonus : "") +
          ((trade > 0) ? ((food > 0 || hammer > 0) ? " " : "") + tradeBonus : ""));
        
        improveDetails.setJSONObject("special", improveSpecial);
        improveList.append(improveDetails);
      }
    }
  }
  
  JSONArray techs = dataObj.getJSONArray("technologies");
  
  for (int i = 0; i < techs.size(); i++) {
    JSONObject checkTech = techs.getJSONObject(i);
    for (int j = 0; j < improveList.size(); j++) {
      JSONObject checkImprovement = improveList.getJSONObject(j);
      
      if(checkTech.getString("id").equals(checkImprovement.getString("prereq"))) {
        if (checkTech.isNull("special") == true) {
          JSONArray specials = new JSONArray();
          specials.append(checkImprovement.getJSONObject("special"));
          checkTech.setJSONArray("special", specials);
        } else {
          JSONArray specials = checkTech.getJSONArray("special");
          specials.append(checkImprovement);
        }
      }
    }
  }
}

void getPromotionInfos(String path, JSONObject dataObj) {
  XML promotionXML = loadXML(path);
  XML promotionInfos = promotionXML.getChild("PromotionInfos");
  XML[] promotionInfo = promotionInfos.getChildren("PromotionInfo");
  
  JSONArray promotionList = new JSONArray();
  
  for (int i = 0; i < promotionInfo.length; i++) {
    String prereq = promotionInfo[i].getChild("TechPrereq").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject promotionDetails = new JSONObject();
      
      promotionDetails.setString("id", promotionInfo[i].getChild("Type").getContent());
      promotionDetails.setString("prereq", prereq);
      
      // Name
      for (int j = 0; j < textObjectsList.length; j++) {
        String tag = textObjectsList[j].getChild("Tag").getContent();
        if (tag.equals(promotionInfo[i].getChild("Description").getContent())) {
          promotionDetails.setString("name", textObjectsList[j].getChild(language).getContent());
        }
      }
      
      promotionList.append(promotionDetails);
    }    
  }
  
  dataObj.setJSONArray("promotions", promotionList);
}

// COLLECT RELIGION INFO (name, prerequisite, id)
void getReligionInfos(String path, JSONObject dataObj) {
  XML religionXML = loadXML(path);
  XML religionInfos = religionXML.getChild("ReligionInfos");
  XML[] religionInfo = religionInfos.getChildren("ReligionInfo");
  
  JSONArray religionList = new JSONArray();
  
  for (int i = 0; i < religionInfo.length; i++) {
    String prereq = religionInfo[i].getChild("TechPrereq").getContent();
    JSONObject religionDetails = new JSONObject();
    
    religionDetails.setString("id", religionInfo[i].getChild("Type").getContent());
    religionDetails.setString("prereq", prereq);
    
    // Name
    for (int j = 0; j < textObjectsList.length; j++) {
      String tag = textObjectsList[j].getChild("Tag").getContent();
      if (tag.equals(religionInfo[i].getChild("Description").getContent())) {
        religionDetails.setString("name", textObjectsList[j].getChild(language).getContent());
      }
    }
    
    religionList.append(religionDetails);
  }
  
  dataObj.setJSONArray("religions", religionList);
}

// COLLECT RESOURCE INFO (name, id, prerequisite)
void getResourceInfos(String path, JSONObject dataObj) {
  XML resourceXML = loadXML(path);
  XML resourceInfos = resourceXML.getChild("BonusInfos");
  XML[] resourceInfo = resourceInfos.getChildren("BonusInfo");
  
  JSONArray resourceList = new JSONArray();
  
  for (int i = 0; i < resourceInfo.length; i++) {
    String prereq = resourceInfo[i].getChild("TechReveal").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject religionDetails = new JSONObject();
      
      religionDetails.setString("id", resourceInfo[i].getChild("Type").getContent());
      religionDetails.setString("prereq", prereq);
      
      // Name
      for (int j = 0; j < textObjectsList.length; j++) {
        String tag = textObjectsList[j].getChild("Tag").getContent();
        if (tag.equals(resourceInfo[i].getChild("Description").getContent())) {
          religionDetails.setString("name", textObjectsList[j].getChild(language).getContent());
        }
      }
      
      resourceList.append(religionDetails);
    }
  }
  
  dataObj.setJSONArray("resources", resourceList);
}

// COLLECT BUILDING INFO (name, id, prerequisite)
void getBuildingInfos(String path, XML[][] texts, String civPath, JSONObject dataObj) {
  XML buildingXML = loadXML(path);
  XML buildingInfos = buildingXML.getChild("BuildingInfos");
  XML[] buildingInfo = buildingInfos.getChildren("BuildingInfo");
  
  JSONArray buildingList = new JSONArray();
  
  /*
  
    1. Get the class
    2. Check to make sure you don't already have the class
    3. Create a JSON Array of building types (civilization:, type:, name:)
    4. Check to see if this is a civilization unique building
    4.a If not, add it to the array as a "standard" building
    4.b If yes, add it to the array as a building for that civilization
    
  */
  
  for (int i = 0; i < buildingInfo.length; i++) {
    String prereq = buildingInfo[i].getChild("PrereqTech").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject buildingDetails = new JSONObject();

      // Get the class of this building
      String className = buildingInfo[i].getChild("BuildingClass").getContent();
      
      // Check to make sure this class isn't already in buildings JSON array
      boolean foundClass = false;
      for (int j = 0; j < buildingList.size(); j++) {
        if (className.equals(buildingList.getJSONObject(j).getString("class"))) {
          foundClass = true;
        }
      }
      if (!foundClass) {
        buildingDetails.setString("class", className);
      } else {
        continue;
      }
      
      // Set the technology prerequisites
      JSONArray preReqs = new JSONArray();
      preReqs.append(prereq);
      
      XML techTypes = buildingInfo[i].getChild("TechTypes");
      XML[] prereqTech = techTypes.getChildren("PrereqTech");
      
      for (int j = 0; j < prereqTech.length; j++) {
        if (prereqTech[j].getContent().equals("NONE") == false) {
          preReqs.append(prereqTech[j].getContent());
        }
      }
      
      buildingDetails.setJSONArray("prereq", preReqs);
      
      
      // JSON Array of building types for this class (standard + civilization specific)
      JSONArray buildingTypes = new JSONArray();
      
      for (int j = 0; j < buildingInfo.length; j++) {
        if (className.equals(buildingInfo[j].getChild("BuildingClass").getContent())) {
          
          JSONObject buildingType = new JSONObject();
          
          String buildingId = buildingInfo[j].getChild("Type").getContent();
          buildingType.setString("id", buildingId);
          
          // Name
          String name = "";
          
          for (int k = 0; k < texts.length; k++) {
            for (int l = 0; l < texts[k].length; l++) {
              String tag = texts[k][l].getChild("Tag").getContent();
              if (tag.equals(buildingInfo[j].getChild("Description").getContent())) {
                name = texts[k][l].getChild(language).getContent();
                buildingType.setString("name", name);
              }
            }
            if (name.length() > 0) {
              break; 
            }
          }
          
          if (name.length() <= 0) {
            println("No name found for: " + className);
          }
          
          
          // Get civilization
          XML civXML = loadXML(civPath);
          XML civilizationInfos = civXML.getChild("CivilizationInfos");
          XML[] civilizationInfo = civilizationInfos.getChildren("CivilizationInfo");
          
          JSONObject civ = new JSONObject();
          boolean uniqueFound = false;
          String civDescription = "";
          
          for (int k = 0; k < civilizationInfo.length; k++) {
            if (civilizationInfo[k].getChild("Buildings").hasChildren()) {
              String uniqueType = civilizationInfo[k].getChild("Buildings").getChild("Building").getChild("BuildingType").getContent();
              if (uniqueType.equals(buildingId)) {
                uniqueFound = true;
                civ.setString("id", civilizationInfo[k].getChild("Type").getContent());
                civDescription = civilizationInfo[k].getChild("Description").getContent();
              }
            }
          }
          
          if (!uniqueFound) {
            civ.setString("id", "CIVILIZATION_ALL");
            civ.setString("name", "All");
          } else {
            String civName = "";
            
            for (int k = 0; k < texts.length; k++) {
              for (int l = 0; l < texts[k].length; l++) {
                String tag = texts[k][l].getChild("Tag").getContent();
                if (tag.equals(civDescription)) {
                  civName = texts[k][l].getChild(language).getContent();
                }
              }
              if (civName.length() > 0) {
                break; 
              }
            }
            
            if (civName.length() <= 0) {
              println("No name found for: " + className);
            } else {
              civ.setString("name", civName);
            }
          }

          buildingType.setJSONObject("civilization", civ);
          
          buildingTypes.append(buildingType);
        }
      }
      
      buildingDetails.setJSONArray("types", buildingTypes);
      
      
      buildingList.append(buildingDetails);
    }
  }
  
  dataObj.setJSONArray("buildings", buildingList);
}