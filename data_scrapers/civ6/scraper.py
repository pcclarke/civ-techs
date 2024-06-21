import argparse
import json
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(
    prog='top',
    description='Select a game to scrape: "base" (no expansions), "gnk" (Gods and Kings), or "bnw" (Brave New World)')
parser.add_argument('-g', '--game', type=str, default='base')
parser.add_argument('-f', '--filename', type=str, default='civdata')
args = parser.parse_args()
game = args.game
filename = args.filename

# Set up data structure
data_categories = [
	'technologies'
]
civ_data = {k: [] for k in data_categories}

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
	path_slash = '/' if len(path) > 0 else ''
	try:
		xml = ET.parse(f'{game}/{path}{path_slash}{filename}.xml')
		root = xml.getroot()
	except ET.ParseError as e:
		print(f'Error parsing XML file {filename}: {e}')
		root = None
	except FileNotFoundError as e:
		print(f'File not found: {e}')
		root = None

	return root

def map_text(game, path, filename):
	'''Get descriptive text from an XML file and return a dict.'''
	root = get_root(game, path, filename)

	text_obj = {}

	for text in root.find('BaseGameText'):
		tag = text.get('Tag')
		name = text.find('Text').text
		text_obj[tag] = name

	return text_obj

civ_text = map_text(game, 'Text/en_US', 'Civilizations_Text')
types_text = map_text(game, 'Text/en_US', 'Types_Text')

civilizations = get_root(game, '', 'Civilizations')

civ_traits = civilizations.find('CivilizationTraits')
civ_traits_dict = {}
for row in civ_traits:
	if row.attrib['CivilizationType'] == 'CIVILIZATION_BARBARIAN':
		continue
	if row.attrib['CivilizationType'] in civ_traits_dict:
		civ_traits_dict[row.attrib['CivilizationType']].append(row.attrib['TraitType'])
	else:
		civ_traits_dict[row.attrib['CivilizationType']] = [row.attrib['TraitType']]

def prep_technologies(game: str):
	"""
	Parse the technologies from XML to JSON
	
	Parameters
	game (str): The game version.
	"""
	
	tech_root = get_root(game, '', 'Technologies')
	tech_dict = {}

	# Get basic techology info
	for tech_cost in tech_root.find('Technologies'):
		id = tech_cost.attrib['TechnologyType']
		tech_dict[id] = {
			'id': id,
			'cost': tech_cost.attrib['Cost'],
			'era': tech_cost.attrib['EraType']
			# get 'Name' or 'Description' here?
		}

	# Assign technology preqrequisites
	for tech_pre in tech_root.find('TechnologyPrereqs'):
		id = tech_pre.attrib['Technology']
		prereq = tech_pre.attrib['PrereqTech']
		tech_dict[id].setdefault('requires', []).append(prereq)

	# Assign English names
 
	# Convert technologies to a list
	tech_list = [value for value in tech_dict.values()]

	return tech_list


def prep_projects(game: str):
	'''Projects'''
	projects_root = get_root(game, '', 'Projects')
	projects_list = []

	for project in projects_root.find('Projects'):
		if 'PrereqTech' in project.attrib:
			proj_obj = {
				'id': project.attrib['ProjectType'],
				'requires': [project.attrib['PrereqTech']]
			}
			projects_list.append(proj_obj)
	
	return projects_list


def prep_improvements(game: str):
	'''Improvements'''
	improvements_root = get_root(game, '', 'Improvements')
	improvements_list = []

	for improvement in improvements_root.find('Improvements'):
		if 'PrereqTech' in improvement.attrib:
			improvement_obj = {
				'id': improvement.attrib['ImprovementType'],
				'requires': [improvement.attrib['PrereqTech']]
			}
			improvements_list.append(improvement_obj)
	
	return improvements_list

def prep_buildings(game: str):
	'''Buildings'''

	buildings_root = get_root(game, '', 'Buildings')

	# Buildings to be replaced
	replaces_dict = {
		replaced.attrib['ReplacesBuildingType']: {
			'override': replaced.attrib['CivUniqueBuildingType']
		}
		for replaced in buildings_root.find('BuildingReplaces')
	}
	
	replaces_list = [
		replaced.attrib['CivUniqueBuildingType']
		for replaced in buildings_root.find('BuildingReplaces')	
	]

	for civ in civ_traits_dict:
		for trait in civ_traits_dict[civ]:
			for building_class in replaces_dict:
				if trait.split('TRAIT_CIVILIZATION_')[1] == replaces_dict[building_class]['override']:
					replaces_dict[building_class]['civilization'] = civ
				
	# How to add replaced buildings? Here or later?
	buildings_dict = {}
	for building in buildings_root.find('Buildings'):
		id = building.attrib['BuildingType']
	
		if id in replaces_list:
			continue
		if 'PrereqTech' not in building.attrib:
			continue

		buildings_dict[id] = {
			'id': id,
			'cost': building.attrib['Cost'],
		}

		buildings_dict[id]['requires'] = [building.attrib['PrereqTech']]
		buildings_dict[id]['maintenance'] = building.attrib['Maintenance'] if 'Maintenance' in building.attrib else None
		buildings_dict[id]['CIVILIZATION_ALL'] = {
			'id': id,
			'name': types_text[building.attrib['Name']],
		}

		if id in replaces_dict:
			civ = replaces_dict[id]['civilization']
			override = replaces_dict[id]['override']

			for bd in buildings_root.find('Buildings'):
				bd_id = bd.attrib['BuildingType']
				if bd_id == override:
					name = types_text[bd.attrib['Name']]
			
			buildings_dict[id][civ] = {
				'id': override,
				'name': name
			}
	
	return list(buildings_dict.values())


def prep_resources(game):
	''' Resources'''

	resources_root = get_root(game, '', 'Resources')
	resources_list = []

	for resource in resources_root.find('Resources'):
		if 'PrereqTech' in resource.attrib:
			resources_list.append({
				'id': resource.attrib['ResourceType'],
				'requires': [resource.attrib['PrereqTech']],
				'name': types_text[resource.attrib['Name']]
			})

	return resources_list

def prep_units(game):
	''' Units '''

	units_root = get_root(game, '', 'Units')

	# Units to be replaced
	replaces_dict = {}
	for replaced in units_root.find('UnitReplaces'):
		if replaced.attrib['ReplacesUnitType'] in replaces_dict:
			replaces_dict[replaced.attrib['ReplacesUnitType']]['replaces'].append(replaced.attrib['CivUniqueUnitType'])
		else:
			replaces_dict[replaced.attrib['ReplacesUnitType']] = {
				'replaces': [replaced.attrib['CivUniqueUnitType']]
			}
	
	replaces_list = [
		replaced.attrib['CivUniqueUnitType']
		for replaced in units_root.find('UnitReplaces')	
	]

	for unit_class in replaces_dict:
		for override in replaces_dict[unit_class]['replaces']:
			if 'override' not in replaces_dict[unit_class]:
				replaces_dict[unit_class]['override'] = []
			if override == 'UNIT_NORWEGIAN_LONGSHIP':
				replaces_dict[unit_class]['override'].append([
					'CIVILIZATION_NORWAY', override
				])
			elif override == 'UNIT_ENGLISH_REDCOAT':
				replaces_dict[unit_class]['override'].append([
					'CIVILIZATION_ENGLAND', override
				])	
			else:
				for civ in civ_traits_dict:
					for trait in civ_traits_dict[civ]:
						if trait.split('TRAIT_CIVILIZATION_')[1] == override:
							replaces_dict[unit_class]['override'].append([
								civ, override
							])	

	# Populate units
	units_dict = {}
	for unit in units_root.find('Units'):
		id = unit.attrib['UnitType']
	
		if id in replaces_list:
			continue
		if 'PrereqTech' not in unit.attrib:
			continue

		units_dict[id] = {
			'id': id,
			'cost': unit.attrib['Cost'],
		}

		units_dict[id]['requires'] = [unit.attrib['PrereqTech']]
		units_dict[id]['CIVILIZATION_ALL'] = {
			'id': id,
			'name': types_text[unit.attrib['Name']],
		}

		if id in replaces_dict:
			for civ_override in replaces_dict[id]['override']:
				civ = civ_override[0]
				override_id = civ_override[1]

				for bd in units_root.find('Units'):
					bd_id = bd.attrib['UnitType']
					if bd_id == override_id:
						name = types_text[bd.attrib['Name']]
				
				units_dict[id][civ] = {
					'id': override_id,
					'name': name
				}
	
	return list(units_dict.values())

def prep_civilizations(civilizations):
	'''Civilizations'''

	civ_types = civilizations.find('Civilizations')
	civ_list = []

	for civ in civ_types:
		if civ.attrib['StartingCivilizationLevelType'] != 'CIVILIZATION_LEVEL_FULL_CIV':
			continue

		civ_list.append({
			'id': civ.attrib['CivilizationType'],
			'name': civ_text[civ.attrib['Description']]
		})

	return civ_list

civ_data['technologies'] = prep_technologies(game)
civ_data['projects'] = prep_projects(game)
civ_data['improvements'] = prep_improvements(game)
civ_data['buildings'] = prep_buildings(game)
civ_data['resources'] = prep_resources(game)
civ_data['units'] = prep_units(game)
civ_data['civilizations'] = prep_civilizations(civilizations)

# Save to JSON

with open(f'{filename}.json', 'w') as fp:
	json.dump(civ_data, fp)