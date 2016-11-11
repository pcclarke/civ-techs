import java.util.Map;
HashMap<String, String> keys = new HashMap<String, String>();

void setup() {
  JSONObject civ2;
  String techsFilename = "advances.csv";
  String unitsFilename = "units.csv";
  String buildingsFilename = "improvements.csv";
  
  civ2 = new JSONObject();
  
  getTechs(techsFilename, civ2);
  getBuildings(buildingsFilename, civ2);
  getUnits(unitsFilename, civ2);
  
  JSONObject extras = loadJSONObject("civ2_extra.json");
  civ2.setJSONArray("build", extras.getJSONArray("build"));
  civ2.setJSONArray("civics", extras.getJSONArray("civics"));
  
  saveJSONObject(civ2, "civdata.json");
  
  println("Done!");
}

void getTechs(String path, JSONObject dataObj) {
  Table advances = loadTable(path, "header");
  String[] eras = { "Ancient", "Renaissance", "Industrial Revolution", "Modern" };
  String[] categories = { "Military", "Economic", "Social", "Academic", "Applied" };
  
  for (TableRow advance : advances.rows()) {
    String name = advance.getString("Advance");
    String advKey = advance.getString("Key");
    String id = nameToId(name, "tech");
    
    keys.put(advKey, id);
  }
  
  JSONArray techList = new JSONArray();
  
  for (TableRow advance : advances.rows()) {
    JSONObject techDetails = new JSONObject();
    
    techDetails.setString("name", advance.getString("Advance"));
    
    String id = keys.get(advance.getString("Key"));
    techDetails.setString("id", id);
    
    String eraName = eras[advance.getInt("Era")];
    techDetails.setString("era", eraName);
    
    String categoryName = categories[advance.getInt("Category")];
    techDetails.setString("category", categoryName);
    
    String prereq1 = advance.getString("Prereq1");
    String prereq2 = advance.getString("Prereq2");
    
    if (!prereq1.equals("nil")) {
      JSONArray requires = new JSONArray();
      requires.append(keys.get(prereq1));
      
      if (!prereq2.equals("nil")) {
        requires.append(keys.get(prereq2));
      }
      techDetails.setJSONArray("requires", requires);
    }
    
    techList.append(techDetails);
  }
  
  dataObj.setJSONArray("technologies", techList);
}

void getBuildings(String path, JSONObject dataObj) {
  Table improvements = loadTable(path, "header");
  JSONArray buildingList = new JSONArray();
  
  for (TableRow improvement : improvements.rows()) {
    JSONObject improvementDetails = new JSONObject();
    String name = improvement.getString("Improvement");
    
    improvementDetails.setString("name", name);
    improvementDetails.setString("id", nameToId(name, "building"));
    improvementDetails.setInt("cost", improvement.getInt("Cost"));
    improvementDetails.setInt("upkeep", improvement.getInt("Upkeep"));
    
    String prereq = improvement.getString("Prereq");
    improvementDetails.setString("requires", keys.get(prereq));
    
    /*String prereq = improvement.getString("Prereq");
    if (!prereq.equals("nil")) {
      JSONArray requires = new JSONArray();
      requires.append(keys.get(prereq));
      improvementDetails.setJSONArray("requires", requires);
    }*/
    
    String obsolete1 = improvement.getString("Obs1");
    String obsolete2 = improvement.getString("Obs2");
    if (!obsolete1.equals("nil")) {
      improvementDetails.setString("obsolete", keys.get(obsolete1));

      if (!obsolete2.equals("nil")) {
        improvementDetails.setString("obsolete2", keys.get(obsolete2));
      }
    }
    buildingList.append(improvementDetails);
  }
  
  dataObj.setJSONArray("buildings", buildingList);
}

void getUnits(String path, JSONObject dataObj) {
  Table units = loadTable(path, "header");
  JSONArray unitList = new JSONArray();
  
  for (TableRow unit : units.rows()) {
    JSONObject unitDetails = new JSONObject();
    String name = unit.getString("Unit");
    
    unitDetails.setString("name", name);
    unitDetails.setString("id", nameToId(name, "unit"));
    unitDetails.setInt("cost", unit.getInt("Cost"));
    unitDetails.setInt("moves", unit.getInt("Move"));
    unitDetails.setInt("range", unit.getInt("Range")); // air fuel range
    unitDetails.setInt("attack", unit.getInt("Attack"));
    unitDetails.setInt("defense", unit.getInt("Defense"));
    unitDetails.setInt("hp", unit.getInt("Hit Points"));
    unitDetails.setInt("firepower", unit.getInt("Firepower"));
    unitDetails.setInt("holds", unit.getInt("Holds"));
    
    String prereq = unit.getString("Prereq");
    if (!prereq.equals("nil")) {
      unitDetails.setString("requires", keys.get(prereq));
    }
    
    String obsolete = unit.getString("Obsolete");
    if (!obsolete.equals("nil")) {
      unitDetails.setString("obsolete", keys.get(obsolete));
    }
    
    unitList.append(unitDetails);
  }
  
  dataObj.setJSONArray("units", unitList);
}

String nameToId(String inputName, String type) {
  String[] nameSplit = splitTokens(inputName, " ");
  for (int i = 0; i < nameSplit.length; i++) {
    
    if (match(nameSplit[i], "'") != null) { // Check for apostophes
      String[] nameApSplit = splitTokens(nameSplit[i], "'");
      for (int j = 0; j < nameApSplit.length; j++) {
        if (nameApSplit[j].equals("'")) {
          nameApSplit[j] = "";
        }
      }
      nameSplit[i] = join(nameApSplit, "");
    }
    
    if (match(nameSplit[i], ".") != null) { // Check for periods
      String[] nameApSplit = splitTokens(nameSplit[i], ".");
      for (int j = 0; j < nameApSplit.length; j++) {
        if (nameApSplit[j].equals(".")) {
          nameApSplit[j] = "";
        }
      }
      nameSplit[i] = join(nameApSplit, "");
    }
    
    nameSplit[i] = nameSplit[i].toUpperCase();
  }
  String id = join(nameSplit, "_");
  id = type.toUpperCase() + "_" + id;
  
  return id;
}