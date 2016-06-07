JSONObject technologies;
XML techsXML, buildXML;
XML textXML, textObjectXML;
String techsXMLFilename = "XML/Technologies/CIV4TechInfos.xml";
String buildXMLFilename = "XML/Units/CIV4BuildInfos.xml";
String textObjectsXMLFilename = "XML/Text/CIV4GameTextInfos_Objects.xml";
String textXMLFilename = "XML/Text/CIV4GameTextInfos.xml";
String language = "English";

void setup() {
  // SETUP TEXT XMLs
  
  textXML = loadXML(textXMLFilename);
  XML[] textList = textXML.getChildren("TEXT");
  
  textObjectXML = loadXML(textObjectsXMLFilename);
  XML[] textObjectsList = textObjectXML.getChildren("TEXT");
  
  // GET TECHNOLOGY DATA
  
  techsXML = loadXML(techsXMLFilename);
  XML techInfos = techsXML.getChild("TechInfos"); 
  XML[] techInfo = techInfos.getChildren("TechInfo");
  
  technologies = new JSONObject();
  
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
          //println("OR: " + orPreReqs[j].getContent());
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
    
    int cost = Integer.parseInt(techInfo[i].getChild("iCost").getContent());
    techDetails.setInt("cost", cost);
    
    techList.append(techDetails);
  }
  
  technologies.setJSONArray("technologies", techList);
  
  
  // GET BUILD DATA
  
  buildXML = loadXML(buildXMLFilename);
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
  
  technologies.setJSONArray("build", buildList);
  
  
  println(technologies);
  saveJSONObject(technologies, "technologies.json");
}