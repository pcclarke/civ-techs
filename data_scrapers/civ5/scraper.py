import argparse
import json
import re
import xml.etree.ElementTree as ET

CIVILIZATION_BARBARIAN = 'CIVILIZATION_BARBARIAN'
CIVILIZATION_MINOR = 'CIVILIZATION_MINOR'

parser = argparse.ArgumentParser(
    prog='top',
    description='Select a game to scrape: "base" (no expansions), "gnk" (Gods and Kings), or "bnw" (Brave New World)')
parser.add_argument('-g', '--game', type=str, default='base')
parser.add_argument('-f', '--filename', type=str, default='civdata')
args = parser.parse_args()
game = args.game
filename = args.filename

def get_root(game: str, path: str, filename: str):
	"""
	Return the root of an XML file.

	Parameters:
	game (str): The game version.
	path (str): The path to the XML file.
	filename (str): The name of the XML file.

	Returns:
	ET.Element: The root element of the XML file.
	"""
	try:
		xml = ET.parse(f'{game}/XML/{path}/{filename}.xml')
		root = xml.getroot()
	except ET.ParseError as e:
		print(f"Error parsing XML file {filename}: {e}")
		root = None
	except FileNotFoundError as e:
		print(f"File not found: {e}")
		root = None

	return root

def map_text(game, path, filename):
	'''Get descriptive text from an XML file and return a dict.'''
	root = get_root(game, path, filename)

	text_obj = {}

	for text in root.find('Language_en_US'):
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
base_text = ['base', 'NewText/EN_US']
gnk_text = ['gnk', 'Text/en_US']
bnw_text = ['bnw', 'Text/en_US']

building_text = map_text(*base_text, 'CIV5GameTextInfos_Buildings')
building_gnk_text = map_text(*gnk_text, 'CIV5GameTextInfos_Buildings_Expansion')
building_inh_text = map_text(*bnw_text, 'CIV5GameTextInfos_Buildings_Inherited_Expansion2')
building_bnw_text = map_text(*bnw_text, 'CIV5GameTextInfos_Buildings_Expansion2')

civilizations_text = map_text(*base_text, 'CIV5GameTextInfos_Civilizations')
civilizations_gnk_text = map_text(*gnk_text, 'CIV5GameTextInfos_Civilizations_Expansion')
civilizations_inh_text = map_text(*bnw_text, 'CIV5GameTextInfos_Civilizations_Inherited_Expansion2')
civilizations_bnw_text = map_text(*bnw_text, 'CIV5GameTextInfos_Civilizations_Expansion2')

civilopedia_text = map_text(*base_text, 'CIV5GameTextInfos_Civilopedia')
civilopedia_gnk_text = map_text(*gnk_text, 'CIV5GameTextInfos_Civilopedia_Expansion')

objects_text = map_text(*base_text, 'CIV5GameTextInfos_Objects')
objects_bnw_text = map_text(*bnw_text, 'CIV5GameTextInfos_Objects_Expansion2')

jon_text = map_text(*base_text, 'CIV5GameTextInfos_Jon')
jon_gnk_text = map_text(*gnk_text, 'CIV5GameTextInfos_Jon_Expansion')
jon_inh_text = map_text(*bnw_text, 'CIV5GameTextInfos_Jon_Inherited_Expansion2')
jon_bnw_text = map_text(*bnw_text, 'CIV5GameTextInfos_Jon_Expansion2')

# TODO: How to load jon_text for bnw

unit_text = map_text(*base_text, 'CIV5GameTextInfos_Units')
unit_gnk_text = map_text(*gnk_text, 'CIV5GameTextInfos_Units_Expansion')
unit_inh_text = map_text(*bnw_text, 'CIV5GameTextInfos_Units_Inherited_Expansion2')
unit_bnw_text = map_text(*bnw_text, 'CIV5GameTextInfos_Units_Expansion2')

tech_base_text = map_text(*base_text, 'CIV5GameTextInfos_Techs')
tech_gnk_text = map_text(*gnk_text, 'CIV5GameTextInfos_Techs_Expansion')
tech_bnw_text = map_text(*bnw_text, 'CIV5GameTextInfos_Techs_Expansion2')


#### Common XML roots ####
civilizations = get_root(game, 'Civilizations', 'CIV5Civilizations')
civilizations_gnk = get_root('gnk', 'Civilizations', 'CIV5Civilizations_Expansion')
civilizations_inh = get_root('bnw', 'Civilizations', 'CIV5Civilizations_Inherited_Expansion2')
civilizations_bnw = get_root('bnw', 'Civilizations', 'CIV5Civilizations_Expansion2')


def prep_technologies(game: str):
	''' Load technologies XML '''
	tech_root = get_root(game, 'Technologies', 'CIV5Technologies')
	tech_dict = {}

		# Get basic technology info
	for tech in tech_root.find('Technologies'):
		id = tech.find('Type').text
		tech_dict[id] = {
			'id': id,
			'cost': tech.find('Cost').text,
			'era': tech.find('Era').text,
			'title_key': tech.find('Description').text,
		}

	# Assign technology prerequisites
	for tech in tech_root.find('Technology_PrereqTechs'):
		id = tech.find('TechType').text
		prereq = tech.find('PrereqTech').text
		tech_dict[id].setdefault('requires', []).append(prereq)

	# Assign English names
	for key, value in tech_dict.items():
		title_key = value['title_key']
		for text_dict in [tech_base_text, tech_gnk_text, tech_bnw_text]:
			if title_key in text_dict:
				value['name'] = text_dict[title_key]
				break

	# Convert technologies to a list
	tech_list = [value for value in tech_dict.values()]

	return tech_list


def prep_promotions(game: str):
	''' Promotions '''
	promotions_root = get_root(game, 'Units', 'CIV5UnitPromotions')
	promotions_list = []

	for promotion in promotions_root.find('UnitPromotions'):
		tech_prereq = promotion.find('TechPrereq')
		if tech_prereq is not None:
			prom_obj = {
				'id': promotion.find('Type').text,
				'requires': [tech_prereq.text],
				'name': promotion.find('Description').text
			}
			promotions_list.append(prom_obj)

	return promotions_list


def prep_projects():
	''' Projects '''
	projects_root = get_root('base', 'GameInfo', 'CIV5Projects')
	projects_list = []

	for project in projects_root.find('Projects'):
		tech_prereq = project.find('TechPrereq')
		if tech_prereq is not None:
			proj_obj = {
				'id': project.find('Type').text,
				'requires': [tech_prereq.text]
			}
			projects_list.append(proj_obj)

	return projects_list


def prep_improvements(root, text):
	''' Worker builds/improvements '''
	builds_list = []

	for build in root.find('Builds'):
		prereq_tech = build.find('PrereqTech')
		if prereq_tech is not None and build.find('Type').text != 'BUILD_FISHING_BOATS_NO_KILL':
			build_obj = {
				'id': build.find('Type').text,
				'requires': [prereq_tech.text],
				'name': None
			}
			text_key = build.find('Description').text

			for text_map in text:
				if text_key in text_map:
					build_text = text_map[text_key]
					build_obj['name'] = re.sub(r'\[[^\]]*\]', '', build_text)
					break

			builds_list.append(build_obj)

	return builds_list


def prep_buildings(buildings, classes, civilizations, text):
	''' City buildings '''

	# Get a list of all building classes
	building_classes_obj = {
		building_class.find('Type').text: {'id': building_class.find('Type').text}
		for class_file in classes
		for building_class in class_file.find('BuildingClasses')
		if building_class.tag != 'Delete'
	}

	# Find out which buildings have civ overrides
	buildings_override = {
		override.find('BuildingType').text: override.find('CivilizationType').text
		for civilization_file in civilizations
		for override in civilization_file.find('Civilization_BuildingClassOverrides')
		if override.find('BuildingType') is not None
	}

	# Assign building requirements
	for building_file in buildings:
		for building in building_file.find('Buildings'):
			building_class = building.find('BuildingClass')
			if building_class is not None:
				building_class_text = building_class.text
				prereq_tech = building.find('PrereqTech')
				if prereq_tech is not None:
					if prereq_tech.text not in building_classes_obj[building_class_text].setdefault('requires', []):
						building_classes_obj[building_class_text]['requires'].append(prereq_tech.text)

				building_type = building.find('Type').text
				building_description = building.find('Description').text

				civ_obj = {'id': building_type, 'name': None}

				for text_map in text:
					if building_description in text_map:
						civ_obj['name'] = text_map[building_description]
						break

				building_classes_obj[building_class_text][buildings_override.get(building_type, 'CIVILIZATION_ALL')] = civ_obj

	# Assign building info to main data
	buildings_list = list(building_classes_obj.values())

	return buildings_list


def prep_resources(game, text):
	'''Resources'''

	resources_root = get_root(game, 'Terrain', 'CIV5Resources')
	resource_list = [
		{
			'id': resource.find('Type').text,
			'requires': [resource.find('TechReveal').text],
			'name': text[resource.find('Description').text]
		}
		for resource in resources_root.find('Resources')
		if resource.find('TechReveal') is not None
	]

	return resource_list


def prep_units(units, classes, civilizations, text):
	''' Units '''

	# Get a list of all unit classes
	unit_classes_obj = {
		unit_class.find('Type').text: {'id': unit_class.find('Type').text}
		for class_file in classes
		for unit_class in class_file.find('UnitClasses')
	}

	# Find out which units have civ overrides
	units_override = {
		override.find('UnitType').text: override.find('CivilizationType').text
		for civilization_file in civilizations
		for override in civilization_file.find('Civilization_UnitClassOverrides')
		if override.find('UnitType') is not None and override.find('CivilizationType').text not in ['CIVILIZATION_BARBARIAN', 'CIVILIZATION_MINOR']
	}

	# Assign unit requirements
	for unit_file in units:
		for unit in unit_file.find('Units'):
			type = unit.find('Type')

			if type is None or type.text is None or 'UNIT_BARBARIAN' in type.text:
				continue

			unit_class = unit.find('Class').text
			prereq_tech = unit.find('PrereqTech')

			if prereq_tech is not None:
				if prereq_tech.text not in unit_classes_obj[unit_class].setdefault('requires', []):
					unit_classes_obj[unit_class]['requires'].append(prereq_tech.text)

			unit_type = type.text
			unit_description = unit.find('Description').text

			civ_obj = {
				'id': unit_type,
				'name': next((text_map[unit_description] for text_map in text if unit_description in text_map), None)
			}

			unit_classes_obj[unit_class][units_override.get(unit_type, 'CIVILIZATION_ALL')] = civ_obj

	# Assign unit info to main data
	units_list = list(unit_classes_obj.values())

	return units_list


def prep_civilizations(civilizations, text):
	'''Civilizations'''

	civ_list = [
		{
				'id': civ_type,
				'name': next((text_map[description] for text_map in text if description in text_map), None)
		}
		for civilization_file in civilizations
		for civilization in civilization_file.find('Civilizations')
		if (civ_type := civilization.find('Type').text) not in ['CIVILIZATION_BARBARIAN', 'CIVILIZATION_MINOR']
		if (description := civilization.find('Description').text) is not None
	]

	return civ_list


civ_data['technologies'] = prep_technologies(game)
civ_data['promotions'] = prep_promotions(game)
civ_data['projects'] = prep_projects()
civ_data['build'] = prep_improvements(
	get_root(game, 'Units', 'CIV5Builds'),
	[jon_text]
)
civ_data['resources'] = prep_resources(game, objects_text)

if game == 'base':
	civ_data['buildings'] = prep_buildings(
		[get_root(game, 'Buildings', 'CIV5Buildings')],
		[get_root(game, 'Buildings', 'CIV5BuildingClasses')],
		[civilizations],
		[building_text, objects_text]
	)

	civ_data['units'] = prep_units(
		[get_root(game, 'Units', 'CIV5Units')],
		[get_root(game, 'Units', 'CIV5UnitClasses')],
		[civilizations],
		[unit_text, objects_text, civilopedia_text]
	)

	civ_data['civilizations'] = prep_civilizations(
		[civilizations],
		[civilizations_text]
	)
elif game == 'gnk':
	builds_gnk_root = get_root(game, 'Units', 'CIV5Builds_Expansion')
	civ_data['build'] = civ_data['build'] + prep_improvements(builds_gnk_root, [jon_gnk_text])

	civ_data['buildings'] = prep_buildings(
		[
			get_root(game, 'Buildings', 'CIV5Buildings'),
			get_root(game, 'Buildings', 'CIV5Buildings_Expansion'),
		],
		[
			get_root(game, 'Buildings', 'CIV5BuildingClasses'),
			get_root(game, 'Buildings', 'CIV5BuildingClasses_Expansion')
		],
		[civilizations, civilizations_gnk],
		[building_text, building_gnk_text, objects_text]
	)

	civ_data['units'] = prep_units(
		[
			get_root(game, 'Units', 'CIV5Units'),
			get_root(game, 'Units', 'CIV5Units_Expansion')
		],
		[
			get_root(game, 'Units', 'CIV5UnitClasses'),
			get_root(game, 'Units', 'CIV5UnitClasses_Expansion')
		],
		[civilizations, civilizations_gnk],
		[unit_text, unit_gnk_text, objects_text, civilopedia_text]
	)

	civ_data['civilizations'] = prep_civilizations(
		[civilizations, civilizations_gnk],
		[civilizations_text, civilizations_gnk_text]
	)
elif game == 'bnw':
	builds_gnk_root = get_root(game, 'Units', 'CIV5Builds_Inherited_Expansion2')
	builds_bnw_root = get_root(game, 'Units', 'CIV5Builds_Expansion2')
	civ_data['build'] = civ_data['build'] + prep_improvements(builds_gnk_root, [jon_inh_text]) + prep_improvements(builds_bnw_root, [jon_bnw_text, objects_bnw_text])

	civ_data['buildings'] = prep_buildings(
		[
			get_root(game, 'Buildings', 'CIV5Buildings'),
			get_root(game, 'Buildings', 'CIV5Buildings_Inherited_Expansion2'),
			get_root(game, 'Buildings', 'CIV5Buildings_Expansion2')
		],
		[
			get_root(game, 'Buildings', 'CIV5BuildingClasses'),
			get_root(game, 'Buildings', 'CIV5BuildingClasses_Inherited_Expansion2'),
			get_root(game, 'Buildings', 'CIV5BuildingClasses_Expansion2')
		],
		[
			civilizations,
			civilizations_inh,
			civilizations_bnw
		],
		[
			building_text,
			building_inh_text,
			building_bnw_text,
			objects_text
		]
	)

	civ_data['units'] = prep_units(
		[
			get_root(game, 'Units', 'CIV5Units'),
			get_root(game, 'Units', 'CIV5Units_Inherited_Expansion2'),
			get_root(game, 'Units', 'CIV5Units_Expansion2')
		],
		[
			get_root('gnk', 'Units', 'CIV5UnitClasses'),
			get_root(game, 'Units', 'CIV5UnitClasses_Inherited_Expansion2'),
			get_root(game, 'Units', 'CIV5UnitClasses_Expansion2')
		],
		[civilizations, civilizations_inh, civilizations_bnw],
		[
			unit_text,
			unit_inh_text,
			unit_bnw_text,
			objects_text,
			civilopedia_text
		]
	)

	civ_data['civilizations'] = prep_civilizations(
		[civilizations, civilizations_inh, civilizations_bnw],
		[civilizations_text, civilizations_inh_text, civilizations_bnw_text]
	)

# ##### Save to JSON #####

with open(f'{filename}.json', 'w') as fp:
    json.dump(civ_data, fp)

