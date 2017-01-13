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
  
  XML gameTextBTSXML = loadXML("bts/XML/Text/CIV4GameText_BTS.xml");
  XML[] gameTextBTSList = gameTextBTSXML.getChildren("TEXT");
  
  XML gameTextBTS_FixedXML = loadXML("bts/XML/Text/CIV4GameText_BTS_Fixed.xml");
  XML[] gameTextBTS_FixedList = gameTextBTS_FixedXML.getChildren("TEXT");
  
  XML[][] civ4baseTexts = { textList, textObjectsList };
  
  XML[][] texts ={ 
    textList,
    textObjectsList, 
    gameTextWarList, 
    textObjectsWarList, 
    textObjectsBTSList,
    gameTextBTSList,
    gameTextBTS_FixedList };
  
  // LOAD IN DATA
  
  // Civilization 4 vanilla
  getTechs("civ4/XML/Technologies/CIV4TechInfos.xml", civ4base, "base");
  getBuilds("civ4/XML/Units/CIV4BuildInfos.xml", civ4baseTexts, civ4base);
  getImprovementInfos("civ4/XML/Terrain/CIV4ImprovementInfos.xml", civ4base);
  getPromotionInfos("civ4/XML/Units/CIV4PromotionInfos.xml", civ4base);
  getReligionInfos("civ4/XML/GameInfo/CIV4ReligionInfo.xml", civ4base);
  getResourceInfos("civ4/XML/Terrain/CIV4BonusInfos.xml", civ4base);
  String civ4Civilizations = "civ4/XML/Civilizations/CIV4CivilizationInfos.xml";
  String civ4SpecialBuildings = "civ4/XML/Buildings/CIV4SpecialBuildingInfos.xml";
  getBuildingInfos("civ4/XML/Buildings/CIV4BuildingInfos.xml", civ4SpecialBuildings, texts, civ4Civilizations, civ4base);
  getUnitInfos("civ4/XML/Units/CIV4UnitInfos.xml", texts, civ4Civilizations, civ4base);
  getCivicsInfos("civ4/XML/GameInfo/CIV4CivicInfos.xml", texts, civ4base);
  getCivilizationInfos(civ4Civilizations, texts, civ4base);
  String civ4Projects = "civ4/XML/GameInfo/CIV4ProjectInfo.xml";
  getProjectInfo(civ4Projects, texts, civ4base);
  
  // Civilization 4: Warlords
  getTechs("war/XML/Technologies/CIV4TechInfos.xml", civ4war, "war");
  getBuilds("war/XML/Units/CIV4BuildInfos.xml", texts, civ4war);
  getImprovementInfos("war/XML/Terrain/CIV4ImprovementInfos.xml", civ4war);
  getPromotionInfos("war/XML/Units/CIV4PromotionInfos.xml", civ4war);
  getReligionInfos("civ4/XML/GameInfo/CIV4ReligionInfo.xml", civ4war); // civ4 dir not a typo
  getResourceInfos("war/XML/Terrain/CIV4BonusInfos.xml", civ4war);
  String warCivilizations = "war/XML/Civilizations/CIV4CivilizationInfos.xml";
  getBuildingInfos("war/XML/Buildings/CIV4BuildingInfos.xml", civ4SpecialBuildings, texts, warCivilizations, civ4war);
  getUnitInfos("war/XML/Units/CIV4UnitInfos.xml", texts, warCivilizations, civ4war);
  getCivicsInfos("war/XML/GameInfo/CIV4CivicInfos.xml", texts, civ4war);
  getCivilizationInfos(warCivilizations, texts, civ4war);
  getProjectInfo(civ4Projects, texts, civ4war);

  // Civilization 4: Beyond the Sword
  getTechs("bts/XML/Technologies/CIV4TechInfos.xml", civ4bts, "bts");
  getBuilds("bts/XML/Units/CIV4BuildInfos.xml", texts, civ4bts);
  getImprovementInfos("bts/XML/Terrain/CIV4ImprovementInfos.xml", civ4bts);
  getPromotionInfos("bts/XML/Units/CIV4PromotionInfos.xml", civ4bts);
  getReligionInfos("bts/XML/GameInfo/CIV4ReligionInfo.xml", civ4bts);
  getResourceInfos("war/XML/Terrain/CIV4BonusInfos.xml", civ4bts); // war dir not a typo
  String btsCivilizations = "bts/XML/Civilizations/CIV4CivilizationInfos.xml";
  String btsSpecialBuildings = "bts/XML/Buildings/CIV4SpecialBuildingInfos.xml";
  getBuildingInfos("bts/XML/Buildings/CIV4BuildingInfos.xml", btsSpecialBuildings, texts, btsCivilizations, civ4bts);
  getUnitInfos("bts/XML/Units/CIV4UnitInfos.xml", texts, btsCivilizations, civ4bts);
  getCivicsInfos("bts/XML/GameInfo/CIV4CivicInfos.xml", texts, civ4bts);
  getCivilizationInfos(btsCivilizations, texts, civ4bts);
  getProjectInfo("bts/XML/GameInfo/CIV4ProjectInfo.xml", texts, civ4bts);
  addOrder("civ4_order.csv", civ4bts);
  
  //println(civ4bts);
  saveJSONObject(civ4base, "civ4/civdata.json");
  saveJSONObject(civ4war, "war/civdata.json");
  saveJSONObject(civ4bts, "bts/civdata.json");
  
  println("Done!");
}

// GET TECHNOLOGY DATA
void getTechs(String path, JSONObject dataObj, String ver) {
  techsXML = loadXML(path);
  XML techInfos = techsXML.getChild("TechInfos"); 
  XML[] techInfo = techInfos.getChildren("TechInfo");
  
  JSONArray techList = new JSONArray();
  
  for (int i = 0; i < techInfo.length; i++) {
    JSONObject techDetails = new JSONObject();
    String techType = techInfo[i].getChild("Type").getContent();
    
    // id
    techDetails.setString("id", techType);
    
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
    if (techType.equals("TECH_ENGINEERING")) {
      JSONObject special = new JSONObject();
      special.setString("name", "+1 Road Movement");
      special.setString("id", "SPECIAL_ROAD_MOVE");
      specialList.append(special);
    }
    
    // Workers produce +50% Hammers from chopping
    int chopBonus = Integer.parseInt(techInfo[i].getChild("iFeatureProductionModifier").getContent());
    if (chopBonus > 0) {
      JSONObject special = new JSONObject();
      special.setString("name", "Workers produce +50% Hammers from chopping");
      special.setString("id", "SPECIAL_CHOP_BONUS");
      specialList.append(special);
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


// GET BUILD DATA (id, prerequisite, name)
void getBuilds(String path, XML[][] texts, JSONObject dataObj) {
  buildXML = loadXML(path);
  XML[] buildInfo = buildXML.getChild("BuildInfos").getChildren("BuildInfo");
  
  JSONArray buildList = new JSONArray();
  
  for (int i = 0; i < buildInfo.length; i++) {
    JSONObject buildDetails = new JSONObject();
    
    // id
    buildDetails.setString("id", buildInfo[i].getChild("Type").getContent());
    
    // prereq tech
    JSONArray required = new JSONArray();
    String prereq = buildInfo[i].getChild("PrereqTech").getContent();
    if (prereq.equals("NONE")) {
      String featurePrereq = buildInfo[i].getChild("FeatureStructs").getChild("FeatureStruct").getChild("PrereqTech").getContent();
      required.append(featurePrereq);
    } else {
      required.append(prereq);
    }
    buildDetails.setJSONArray("requires", required);
    
    // Name
    String name = "";
    
    for (int k = 0; k < texts.length; k++) {
      for (int l = 0; l < texts[k].length; l++) {
        String tag = texts[k][l].getChild("Tag").getContent();
        if (tag.equals(buildInfo[i].getChild("Description").getContent())) {
          name = texts[k][l].getChild(language).getContent();
        }
      }
      if (name.length() > 0) {
        String[] split = splitTokens(name, "[]");
        String[] trimmed = new String[2];
        trimmed[0] = trim(split[0]);
        trimmed[1] = trim(split[2]);
        buildDetails.setString("name", join(trimmed, ' '));
        break; 
      }
    }
    
    buildList.append(buildDetails);
  }
  
  dataObj.setJSONArray("build", buildList);
}


// COLLECT TERRAIN IMPROVEMENT BONUSES (goes into technologies)
void getImprovementInfos(String path, JSONObject dataObj) {
  XML improveXML = loadXML(path);
  XML improveInfos = improveXML.getChild("ImprovementInfos");
  XML[] improveInfo = improveInfos.getChildren("ImprovementInfo");
  
  for (int i = 0; i < improveInfo.length; i++) {    
    String id = improveInfo[i].getChild("Type").getContent();

    if (improveInfo[i].getChild("TechYieldChanges").hasChildren()) {
      XML[] techYieldChanges =  improveInfo[i].getChild("TechYieldChanges").getChildren("TechYieldChange");
      
      for (int j = 0; j < techYieldChanges.length; j++) {
        JSONObject improveSpecial = new JSONObject();
        
        improveSpecial.setString("id", id);
        String prereq = techYieldChanges[j].getChild("PrereqTech").getContent();
        
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
          
        // Put bonus into special array
        JSONArray techs = dataObj.getJSONArray("technologies");
        
        for (int k = 0; k < techs.size(); k++) {
          JSONObject checkTech = techs.getJSONObject(k);
          
          if(checkTech.getString("id").equals(prereq)) {
            if (checkTech.isNull("special") == true) {
              JSONArray specials = new JSONArray();
              specials.append(improveSpecial);
              checkTech.setJSONArray("special", specials);
            } else {
              JSONArray specials = checkTech.getJSONArray("special");
              specials.append(improveSpecial);
            }
          }
        }
      }
    }
  }
}


// COLLECT PROMOTION INFO
void getPromotionInfos(String path, JSONObject dataObj) {
  XML promotionXML = loadXML(path);
  XML promotionInfos = promotionXML.getChild("PromotionInfos");
  XML[] promotionInfo = promotionInfos.getChildren("PromotionInfo");
  
  JSONArray promotionList = new JSONArray();
  
  for (int i = 0; i < promotionInfo.length; i++) {
    String prereq = promotionInfo[i].getChild("TechPrereq").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject promotionDetails = new JSONObject();
      JSONArray required = new JSONArray();
      
      promotionDetails.setString("id", promotionInfo[i].getChild("Type").getContent());
      required.append(prereq);
      promotionDetails.setJSONArray("requires", required);
      
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
    JSONArray required = new JSONArray();
    
    religionDetails.setString("id", religionInfo[i].getChild("Type").getContent());
    required.append(prereq);
    religionDetails.setJSONArray("requires", required);
    
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
  XML[] resourceInfo = resourceXML.getChild("BonusInfos").getChildren("BonusInfo");
  
  JSONArray resourceList = new JSONArray();
  
  for (int i = 0; i < resourceInfo.length; i++) {
    String prereq = resourceInfo[i].getChild("TechReveal").getContent();
    String obsoleteTech = resourceInfo[i].getChild("TechObsolete").getContent();
    if (prereq.equals("NONE") == false || obsoleteTech.equals("NONE") == false) {
      JSONObject resourceDetails = new JSONObject();
      
      // Set id
      resourceDetails.setString("id", resourceInfo[i].getChild("Type").getContent());
      
      // Set technology prerequisite
      if (prereq.equals("NONE") == false) {
        JSONArray required = new JSONArray();
        required.append(prereq);
        resourceDetails.setJSONArray("requires", required);
      }
      
      // Set the technology that makes this resource obsolete
      if (obsoleteTech.equals("NONE") == false) {
        resourceDetails.setString("obsolete", obsoleteTech);
      }
      
      // Name
      for (int j = 0; j < textObjectsList.length; j++) {
        String tag = textObjectsList[j].getChild("Tag").getContent();
        if (tag.equals(resourceInfo[i].getChild("Description").getContent())) {
          resourceDetails.setString("name", textObjectsList[j].getChild(language).getContent());
        }
      }
      
      resourceList.append(resourceDetails);
    }
  }
  
  dataObj.setJSONArray("resources", resourceList);
}


// COLLECT CIVICS INFO
void getCivicsInfos(String path, XML[][] texts, JSONObject dataObj) {
  XML civicXML = loadXML(path);
  XML[] civicInfo = civicXML.getChild("CivicInfos").getChildren("CivicInfo");
  
  JSONArray civicList = new JSONArray();
  
  for (int i = 0; i < civicInfo.length; i++) {
    String prereq = civicInfo[i].getChild("TechPrereq").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject civicDetails = new JSONObject();
      
      // Set id
      civicDetails.setString("id", civicInfo[i].getChild("Type").getContent());
      
      // Set technology prerequisites
      JSONArray required = new JSONArray();
      required.append(prereq);
      civicDetails.setJSONArray("requires", required);
      
      // Name
      String name = "";
      
      for (int k = 0; k < texts.length; k++) {
        for (int l = 0; l < texts[k].length; l++) {
          String tag = texts[k][l].getChild("Tag").getContent();
          if (tag.equals(civicInfo[i].getChild("Description").getContent())) {
            name = texts[k][l].getChild(language).getContent();
          }
        }
        if (name.length() > 0) {
          break; 
        }
      }
      civicDetails.setString("name", name);
      
      civicList.append(civicDetails);
    }
  }
  
  dataObj.setJSONArray("civics", civicList);
}


// COLLECT CIVILIZATION INFO
void getCivilizationInfos(String path, XML[][] texts, JSONObject dataObj) {
  XML civilizationXML = loadXML(path);
  XML[] civilizationInfo = civilizationXML.getChild("CivilizationInfos").getChildren("CivilizationInfo");
  
  JSONArray civilizationList = new JSONArray();
  
  for (int i = 0; i < civilizationInfo.length; i++) {
    String type = civilizationInfo[i].getChild("Type").getContent();
    if (type.equals("CIVILIZATION_MINOR") == false && type.equals("CIVILIZATION_BARBARIAN") == false) {
      JSONObject civilizationDetails = new JSONObject();
      civilizationDetails.setString("id", civilizationInfo[i].getChild("Type").getContent());
      
      // Name
      String name = "";
      
      for (int k = 0; k < texts.length; k++) {
        for (int l = 0; l < texts[k].length; l++) {
          String tag = texts[k][l].getChild("Tag").getContent();
          if (tag.equals(civilizationInfo[i].getChild("Description").getContent())) {
            if (texts[k][l].getChild(language).getChild("Text") != null) {
              name = texts[k][l].getChild(language).getChild("Text").getContent();
            } else {
              name = texts[k][l].getChild(language).getContent();  
            }
          }
        }
        if (name.length() > 0) {
          break; 
        }
      }
      civilizationDetails.setString("name", name);
      
      civilizationList.append(civilizationDetails);
    }
  }
  
  dataObj.setJSONArray("civilizations", civilizationList);
}


// COLLECT PROJECT INFO
void getProjectInfo(String path, XML[][] texts, JSONObject dataObj) {
  XML projectXML = loadXML(path);
  XML[] projectInfo = projectXML.getChild("ProjectInfos").getChildren("ProjectInfo");
  
  JSONArray projectList = new JSONArray();
  
  for (int i = 0; i < projectInfo.length; i++) {
    String prereq = projectInfo[i].getChild("TechPrereq").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject projectDetails = new JSONObject();
      
      // Set id
      projectDetails.setString("id", projectInfo[i].getChild("Type").getContent());
      
      // Set technology prerequisites
      JSONArray required = new JSONArray();
      required.append(prereq);
      projectDetails.setJSONArray("requires", required);
      
      // Name
      String name = "";
      
      for (int k = 0; k < texts.length; k++) {
        for (int l = 0; l < texts[k].length; l++) {
          String tag = texts[k][l].getChild("Tag").getContent();
          if (tag.equals(projectInfo[i].getChild("Description").getContent())) {
            name = texts[k][l].getChild(language).getContent();
          }
        }
        if (name.length() > 0) {
          break; 
        }
      }
      projectDetails.setString("name", name);
      
      projectList.append(projectDetails);
    }
  }
  
  dataObj.setJSONArray("projects", projectList);
}


// COLLECT BUILDING INFO (name, id, prerequisite)
void getBuildingInfos(String path, String specialPath, XML[][] texts, String civPath, JSONObject dataObj) {
  XML buildingXML = loadXML(path);
  XML[] buildingInfo = buildingXML.getChild("BuildingInfos").getChildren("BuildingInfo");
  
  JSONArray buildingList = new JSONArray();
  
  for (int i = 0; i < buildingInfo.length; i++) {
    String prereq = buildingInfo[i].getChild("PrereqTech").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject buildingDetails = new JSONObject();

      // Get the class of this building
      String className = buildingInfo[i].getChild("BuildingClass").getContent();
      
      // Check to make sure this class isn't already in buildings JSON array
      boolean foundClass = false;
      for (int j = 0; j < buildingList.size(); j++) {
        if (className.equals(buildingList.getJSONObject(j).getString("id"))) {
          foundClass = true;
        }
      }
      if (!foundClass) {
        buildingDetails.setString("id", className);
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
      
      buildingDetails.setJSONArray("requires", preReqs);
      
      // Set the technology that makes this building obsolete
      String obsoleteTech = buildingInfo[i].getChild("ObsoleteTech").getContent();
      if (obsoleteTech.equals("NONE") == false) {
        buildingDetails.setString("obsolete", obsoleteTech);
      }
      
      
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
          String civId = "CIVILIZATION_ALL";
          
          
          for (int k = 0; k < civilizationInfo.length; k++) {
            if (civilizationInfo[k].getChild("Buildings").hasChildren()) {
              String uniqueType = civilizationInfo[k].getChild("Buildings").getChild("Building").getChild("BuildingType").getContent();
              if (uniqueType.equals(buildingId)) {
                civId = civilizationInfo[k].getChild("Type").getContent();
              }
            }
          }
          
          buildingDetails.setJSONObject(civId, buildingType);
        }
      }
      
      //buildingDetails.setJSONArray("types", buildingTypes);
      
      
      buildingList.append(buildingDetails);
    }
  }
  
  // Special buildings
  XML specialXML = loadXML(specialPath);
  XML[] specialInfo = specialXML.getChild("SpecialBuildingInfos").getChildren("SpecialBuildingInfo");
  
  for (int i = 0; i < specialInfo.length; i++) {
    String prereq = specialInfo[i].getChild("TechPrereq").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject buildingDetails = new JSONObject();
      
      // Technology prerequisite
      JSONArray required = new JSONArray();
      required.append(prereq);
      buildingDetails.setJSONArray("requires", required);
      
      
      // Technology that makes the building obsolete
      String obsolete = specialInfo[i].getChild("ObsoleteTech").getContent();
      if (obsolete.equals("NONE") == false) {
        buildingDetails.setString("obsolete", obsolete);
      }
      
      //JSONArray types = new JSONArray();
      JSONObject typeObj = new JSONObject();
      
      // Building id
      String type = specialInfo[i].getChild("Type").getContent();
      typeObj.setString("id", type);
      
      // Building name
      String name = "";
          
      for (int k = 0; k < texts.length; k++) {
        for (int l = 0; l < texts[k].length; l++) {
          String tag = texts[k][l].getChild("Tag").getContent();
          if (tag.equals(specialInfo[i].getChild("Description").getContent())) {
            name = texts[k][l].getChild(language).getContent();
            typeObj.setString("name", name);
          }
        }
        if (name.length() > 0) {
          break; 
        }
      }
      
      buildingDetails.setJSONObject("CIVILIZATION_ALL", typeObj);
      
      // Class (invented)
      String specialClass = "BUILDINGCLASS" + type.substring(15);
      buildingDetails.setString("id", specialClass);
      
      buildingList.append(buildingDetails);
    }
  }
  
  dataObj.setJSONArray("buildings", buildingList);
}

// COLLECT UNIT INFO (name, id, prerequisite)
void getUnitInfos(String path, XML[][] texts, String civPath, JSONObject dataObj) {
  XML unitXML = loadXML(path);
  XML[] unitInfo = unitXML.getChild("UnitInfos").getChildren("UnitInfo");
  
  JSONArray unitList = new JSONArray();
  
  for (int i = 0; i < unitInfo.length; i++) {
    String prereq = unitInfo[i].getChild("PrereqTech").getContent();
    if (prereq.equals("NONE") == false) {
      JSONObject unitDetails = new JSONObject();

      // Get the class of this Unit
      String className = unitInfo[i].getChild("Class").getContent();
      
      // Check to make sure this class isn't already in units JSON array
      boolean foundClass = false;
      for (int j = 0; j < unitList.size(); j++) {
        if (className.equals(unitList.getJSONObject(j).getString("id"))) {
          foundClass = true;
        }
      }
      if (!foundClass) {
        unitDetails.setString("id", className);
      } else {
        continue;
      }
      
      unitDetails.setInt("cost", Integer.parseInt(unitInfo[i].getChild("iCost").getContent()));
      unitDetails.setInt("combat", Integer.parseInt(unitInfo[i].getChild("iCombat").getContent()));
      unitDetails.setInt("cityAttack", Integer.parseInt(unitInfo[i].getChild("iCityAttack").getContent()));
      unitDetails.setInt("cityDefense", Integer.parseInt(unitInfo[i].getChild("iCityDefense").getContent()));
      unitDetails.setInt("withdrawalProb", Integer.parseInt(unitInfo[i].getChild("iWithdrawalProb").getContent()));
      
      
      // Set the technology prerequisites
      JSONArray preReqs = new JSONArray();
      preReqs.append(prereq);
      
      XML techTypes = unitInfo[i].getChild("TechTypes");
      XML[] prereqTech = techTypes.getChildren("PrereqTech");
      
      for (int j = 0; j < prereqTech.length; j++) {
        if (prereqTech[j].getContent().equals("NONE") == false) {
          preReqs.append(prereqTech[j].getContent());
        }
      }
      
      unitDetails.setJSONArray("requires", preReqs);
      
      for (int j = 0; j < unitInfo.length; j++) {
        if (className.equals(unitInfo[j].getChild("Class").getContent())) {
          
          JSONObject unitType = new JSONObject();
          
          String unitId = unitInfo[j].getChild("Type").getContent();
          unitType.setString("id", unitId);
          
          // Name
          String name = "";
          
          for (int k = 0; k < texts.length; k++) {
            for (int l = 0; l < texts[k].length; l++) {
              String tag = texts[k][l].getChild("Tag").getContent();
              if (tag.equals(unitInfo[j].getChild("Description").getContent())) {
                name = texts[k][l].getChild(language).getContent();
                unitType.setString("name", name);
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
          
          String civId = "CIVILIZATION_ALL";
          
          for (int k = 0; k < civilizationInfo.length; k++) {
            if (civilizationInfo[k].getChild("Units").hasChildren()) {
              String uniqueType = civilizationInfo[k].getChild("Units").getChild("Unit").getChild("UnitType").getContent();
              if (uniqueType.equals(unitId)) {
                civId = civilizationInfo[k].getChild("Type").getContent();
              }
            }
          }
          
          unitDetails.setJSONObject(civId, unitType);
        }
      }

      unitList.append(unitDetails); 
    }
  }
  
  dataObj.setJSONArray("units", unitList);
}

void addOrder(String orderFileName, JSONObject dataObj) {
  Table orderTable = loadTable(orderFileName, "header");
  
  for (TableRow order : orderTable.rows()) {
    JSONArray techs = dataObj.getJSONArray("technologies");
    
    for (int i = 0; i < techs.size(); i++) {
      if (order.getString("id").equals(techs.getJSONObject(i).getString("id"))) {
        techs.getJSONObject(i).setInt("order", order.getInt(0));
      }
    }
  }
}