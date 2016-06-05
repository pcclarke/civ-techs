JSONObject technologies;
XML techsXML;
XML textXML;
String techsXMLFilename = "XML/Technologies/CIV4TechInfos.xml";
String textXMLFilename = "XML/Text/CIV4GameTextInfos_Objects.xml";
String language = "English";

void setup() {
  techsXML = loadXML(techsXMLFilename);
  XML techInfos = techsXML.getChild("TechInfos"); 
  XML[] techInfo = techInfos.getChildren("TechInfo");
  
  textXML = loadXML(textXMLFilename);
  XML[] textList = textXML.getChildren("TEXT");
  
  technologies = new JSONObject();
  
  JSONArray techList = new JSONArray();
  
  for (int i = 0; i < techInfo.length; i++) {
    JSONObject techDetails = new JSONObject();
    
    // id
    techDetails.setString("id", techInfo[i].getChild("Type").getContent());
    
    // Name
    for (int j = 0; j < textList.length; j++) {
      String txt_key = "TXT_KEY_" + techInfo[i].getChild("Type").getContent();
      String tag = textList[j].getChild("Tag").getContent();
      if (tag.equals(txt_key)) {
        techDetails.setString("name", textList[j].getChild(language).getContent());
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
  
  println(technologies);
  saveJSONObject(technologies, "technologies.json");
}