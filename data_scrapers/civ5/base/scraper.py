import json
import re
import xml.etree.ElementTree as ET

def get_root(path, filename):
	'''Return the root of an XML file'''
	xml = ET.parse(f'XML/{path}/{filename}.xml')
	root = xml.getroot()

	return root

def map_text(filename):
	'''Get descriptive text from an XML file and return a dict.'''
	text_root = get_root('NewText/EN_US', filename)
	text_obj = {}

	for text in text_root.find('Language_en_US'):
		tag = text.get('Tag')
		name = text.find('Text').text
		text_obj[tag] = name

	return text_obj

# Set up data structure
data_categories = [
	'technologies',
	'promotions',
	'projects',
	'build',
	'buildings',
	'resources',
	'units',
	'civilizations'
]
civ_data = {k: [] for k in data_categories}

##### Load English names #####
building_text = map_text('CIV5GameTextInfos_Buildings')
civilizations_text = map_text('CIV5GameTextInfos_Civilizations')
civilopedia_text = map_text('CIV5GameTextInfos_Civilopedia')
info_text = map_text('CIV5GameTextInfos_Objects')
jon_text = map_text('CIV5GameTextInfos_Jon')
unit_text = map_text('CIV5GameTextInfos_Units')
tech_text = map_text('CIV5GameTextInfos_Techs')



##### Load technologies XML #####
tech_root = get_root('Technologies', 'CIV5Technologies')
tech_dict = {}

# Get basic technology info
for tech in tech_root.find('Technologies'):
	info = {}
	id = tech.find('Type').text
	info['id'] = id
	info['cost'] = tech.find('Cost').text
	info['era'] = tech.find('Era').text
	info['title_key'] = tech.find('Description').text
	tech_dict[id] = info

# Assign technology prerequisites
for tech in tech_root.find('Technology_PrereqTechs'):
	id = tech.find('TechType').text
	prereq = tech.find('PrereqTech').text
	if 'requires' not in tech_dict[id]:
		tech_dict[id]['requires'] = [prereq]
	else:
		tech_dict[id]['requires'].append(prereq)

# Assign English names
for key in tech_dict:
	title_key = tech_dict[key]['title_key']
	tech_dict[key]['name'] = tech_text[title_key]

# Convert technologies to an array
for key in tech_dict:
	tech_obj = {}
	dict_obj = tech_dict[key]

	tech_obj['id'] = dict_obj['id']
	tech_obj['cost'] = dict_obj['cost']
	tech_obj['era'] = dict_obj['era']
	tech_obj['name'] = dict_obj['name']

	if 'requires' in dict_obj:
		tech_obj['requires'] = dict_obj['requires']

	civ_data['technologies'].append(tech_obj)


##### Promotions #####
promotions_root = get_root('Units', 'CIV5UnitPromotions')

for promotion in promotions_root.find('UnitPromotions'):
	if promotion.find('TechPrereq') is not None:
		prom_obj = {}

		prom_obj['id'] = promotion.find('Type').text
		prom_obj['requires'] = [promotion.find('TechPrereq').text]
		prom_name_tag = promotion.find('Description').text
		prom_obj['name'] = unit_text[prom_name_tag]

		civ_data['promotions'].append(prom_obj)


##### Projects #####
projects_root = get_root('GameInfo', 'CIV5Projects')

for project in projects_root.find('Projects'):
	if project.find('TechPrereq') is not None:
		proj_obj = {}
		proj_obj['id'] = project.find('Type').text
		proj_obj['requires'] = [project.find('TechPrereq').text]

		civ_data['projects'].append(proj_obj)


##### Worker builds/improvements #####
improvements_root = get_root('Terrain', 'CIV5Improvements')
routes_root = get_root('Misc', 'CIV5Routes')
builds_root = get_root('Units', 'CIV5Builds')

for build in builds_root.find('Builds'):
	if build.find('PrereqTech') is not None:
		build_obj = {}
		build_obj['id'] = build.find('Type').text
		build_obj['requires'] = [build.find('PrereqTech').text]

		build_text = jon_text[build.find('Description').text]
		build_text = re.sub(r'\[[^\]]*\]', '', build_text)
		build_obj['name'] = build_text

		civ_data['build'].append(build_obj)


##### City buildings #####

buildings_root = get_root('Buildings', 'CIV5Buildings')

# Get a list of all building classes
building_classes_root = get_root('Buildings', 'CIV5BuildingClasses')
building_classes_obj = {}

for building_class in building_classes_root.find('BuildingClasses'):
	class_obj = {}
	class_type = building_class.find('Type').text
	class_obj['id'] = class_type
	building_classes_obj[class_type] = class_obj

# Find out which buildings have civ overrides
civilizations_root = get_root('Civilizations', 'CIV5Civilizations')

buildings_override = {}

for override in civilizations_root.find('Civilization_BuildingClassOverrides'):
	building_type = override.find('BuildingType').text
	civ_type = override.find('CivilizationType').text

	if building_type is not None:
		buildings_override[building_type] = civ_type

# Assign building requirements
for building in buildings_root.find('Buildings'):
	building_class = building.find('BuildingClass').text

	if building.find('PrereqTech') is not None:
		if 'requires' not in building_classes_obj[building_class]:
			building_classes_obj[building_class]['requires'] = [building.find('PrereqTech').text]

	building_type = building.find('Type').text
	building_description = building.find('Description').text

	civ_obj = {}
	civ_obj['id'] = building_type

	if building_description in building_text:
		civ_obj['name'] = building_text[building_description]
	else:
		civ_obj['name'] = info_text[building_description]

	if building_type in buildings_override:
		building_classes_obj[building_class][buildings_override[building_type]] = civ_obj
	else:
		building_classes_obj[building_class]['CIVILIZATION_ALL'] = civ_obj

# Assign building info to main data
for key, building in building_classes_obj.items():
	civ_data['buildings'].append(building)


##### Resources #####

resources_root = get_root('Terrain', 'CIV5Resources')

for resource in resources_root.find('Resources'):
	if resource.find('TechReveal') is not None:
		resource_obj = {}

		resource_obj['id'] = resource.find('Type').text
		resource_obj['requires'] = [resource.find('TechReveal').text]

		resource_obj['name'] = info_text[resource.find('Description').text]

		civ_data['resources'].append(resource_obj)


##### Units #####

# Get a list of all unit classes
unit_classes_root = get_root('Units', 'CIV5UnitClasses')
unit_classes_obj = {}

for unit_class in unit_classes_root.find('UnitClasses'):
	class_obj = {}
	class_type = unit_class.find('Type').text
	class_obj['id'] = class_type
	unit_classes_obj[class_type] = class_obj

# Find out which units have civ overrides
units_override = {}

for override in civilizations_root.find('Civilization_UnitClassOverrides'):
	unit_type = override.find('UnitType').text
	civ_type = override.find('CivilizationType').text

	if civ_type != 'CIVILIZATION_BARBARIAN' and civ_type != 'CIVILIZATION_MINOR':
		units_override[unit_type] = civ_type

# Assign unit requirements
units_root = get_root('Units', 'CIV5Units')

for unit in units_root.find('Units'):
	unit_class = unit.find('Class').text

	if unit.find('PrereqTech') is not None:
		if 'requires' not in unit_classes_obj[unit_class]:
			unit_classes_obj[unit_class]['requires'] = [unit.find('PrereqTech').text]

	unit_type = unit.find('Type').text
	unit_description = unit.find('Description').text

	civ_obj = {}
	civ_obj['id'] = unit_type

	if unit_description in unit_text:
		civ_obj['name'] = unit_text[unit_description]
	elif unit_description in info_text:
		civ_obj['name'] = info_text[unit_description]
	else:
		civ_obj['name'] = civilopedia_text[unit_description]

	if unit_type in units_override:
		unit_classes_obj[unit_class][units_override[unit_type]] = civ_obj
	else:
		unit_classes_obj[unit_class]['CIVILIZATION_ALL'] = civ_obj

# Assign building info to main data
for key, unit in unit_classes_obj.items():
	civ_data['units'].append(unit)


##### Civilizations #####

for civilization in civilizations_root.find('Civilizations'):
	civ_type = civilization.find('Type').text

	if civ_type != 'CIVILIZATION_BARBARIAN' and civ_type != 'CIVILIZATION_MINOR':
		civ_obj = {}
		civ_obj['id'] = civ_type

		description = civilization.find('Description').text
		civ_obj['name'] = civilizations_text[description]

		civ_data['civilizations'].append(civ_obj)

print(civ_data['build'])


##### Save to JSON #####

with open('civdata.json', 'w') as fp:
    json.dump(civ_data, fp)

