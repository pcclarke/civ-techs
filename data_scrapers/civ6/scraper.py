import argparse
import json
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(
    prog='top',
    description='Select a game to scrape: "base" (no expansions), "raf" (Rise and Fall), or "gs" (Gathering Storm)')
parser.add_argument('-g', '--game', type=str, default='base')
parser.add_argument('-f', '--filename', type=str, default='civdata')
args = parser.parse_args()
game = args.game
filename = args.filename

games = {
	"base": "base game (no expansions)",
	"raf": "Rise & Fall",
	"gs": "Gatering Storm"
}

# Set up data structure
data_categories = [
	'technologies'
]
civ_data = {k: [] for k in data_categories}

print(f'\nScraping Civilization 6 data for {games[game]} into JSON...\n')

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

def map_text(game, path, filename, parent = 'BaseGameText'):
	'''Get descriptive text from an XML file and return a dict.'''
	root = get_root(game, path, filename)

	text_obj = {}

	for text in root.find(parent):
		tag = text.get('Tag')
		name = text.find('Text').text
		text_obj[tag] = name

	return text_obj

def get_civ_traits(civilizations):
	civ_traits = civilizations.find('CivilizationTraits')

	civ_traits_dict = {}
	for row in civ_traits:
		if row.attrib['CivilizationType'] == 'CIVILIZATION_BARBARIAN':
			continue
		if row.attrib['CivilizationType'] in civ_traits_dict:
			civ_traits_dict[row.attrib['CivilizationType']].append(row.attrib['TraitType'])
		else:
			civ_traits_dict[row.attrib['CivilizationType']] = [row.attrib['TraitType']]

	return civ_traits_dict

##############################
# Data preparation functions #
##############################

def prep_technologies(game: str):
	"""
	Parse the technologies from XML to JSON
	
	Parameters
	game (str): The game version.
	"""

	print('\nScraping technologies\n')

	gameLoad = game if game != 'raf' else 'base'
	
	tech_root = get_root(gameLoad, '', 'Technologies')
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


def prep_projects(game: str, projectFile: str):
	'''Projects'''
	projects_root = get_root(game, '', projectFile)
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

def prep_buildings(game: str, buildingFile, civ_traits, buiding_names):
	'''Buildings'''

	buildings_root = get_root(game, '', buildingFile)

	# Buildings to be replaced
	replaces_dict = {} if buildings_root.find('BuildingReplaces') is None else {
		replaced.attrib['ReplacesBuildingType']: {
			'override': replaced.attrib['CivUniqueBuildingType']
		}
		for replaced in buildings_root.find('BuildingReplaces')
	}
	
	replaces_list = {} if buildings_root.find('BuildingReplaces') is None else [
		replaced.attrib['CivUniqueBuildingType']
		for replaced in buildings_root.find('BuildingReplaces')	
	]

	for civ in civ_traits:
		for trait in civ_traits[civ]:
			for building_class in replaces_dict:
				if trait.split('TRAIT_CIVILIZATION_')[1] == replaces_dict[building_class]['override']:
					replaces_dict[building_class]['civilization'] = civ
				
	# How to add replaced buildings? Here or later?
	buildings_dict = {}
	for building in buildings_root.find('Buildings'):
		if 'BuildingType' not in building.attrib:
			continue

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
			'name': buiding_names[building.attrib['Name']],
		}

		if id in replaces_dict:
			civ = replaces_dict[id]['civilization']
			override = replaces_dict[id]['override']

			for bd in buildings_root.find('Buildings'):
				bd_id = bd.attrib['BuildingType']
				if bd_id == override:
					name = buiding_names[bd.attrib['Name']]
			
			buildings_dict[id][civ] = {
				'id': override,
				'name': name
			}
	
	return list(buildings_dict.values())


def prep_resources(game, resource_names):
	''' Resources'''

	resources_root = get_root(game, '', 'Resources')
	resources_list = []

	for resource in resources_root.find('Resources'):
		if 'PrereqTech' in resource.attrib:
			resources_list.append({
				'id': resource.attrib['ResourceType'],
				'requires': [resource.attrib['PrereqTech']],
				'name': resource_names[resource.attrib['Name']]
			})

	return resources_list

def prep_units(game, units_file, civ_traits, unit_names):
	''' Units '''

	units_root = get_root(game, '', units_file)

	# Units to be replaced
	replaces_dict = {}
	replaces_list = []

	if units_root.find('UnitReplaces'):
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
					for civ in civ_traits:
						for trait in civ_traits[civ]:
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
		}

		units_dict[id]['requires'] = [unit.attrib['PrereqTech']]
		units_dict[id]['CIVILIZATION_ALL'] = {
			'id': id,
			'name': unit_names[unit.attrib['Name']],
		}

		if id in replaces_dict:
			for civ_override in replaces_dict[id]['override']:
				civ = civ_override[0]
				override_id = civ_override[1]

				for bd in units_root.find('Units'):
					bd_id = bd.attrib['UnitType']
					if bd_id == override_id:
						name = unit_names[bd.attrib['Name']]
				
				units_dict[id][civ] = {
					'id': override_id,
					'name': name
				}
	
	return list(units_dict.values())

def prep_units_new(game, units_file, text_file):
	units_root = get_root(game + '_custom', '', units_file)
	unit_text = map_text(game + '_custom', 'text', text_file, 'UnitText')

	unit_civs = {}
	for unit in units_root.find('CivilizationReplaces'):
		id = unit.attrib['UniqueUnit']
		civ = unit.attrib['CivilizationType']
		unit_civs[id] = civ

	unique_list = []
	unique_units = {}
	for unit in units_root.find('UnitReplaces'):
		id = unit.attrib['CivUniqueUnitType']
		unique_list.append(id)
		replace_obj = {'id': id, 'civ': unit_civs[id]}
		type = unit.attrib['ReplacesUnitType']

		if type in unique_units:
			unique_units[type].append(replace_obj)
		else:
			unique_units[type] = [replace_obj]

	units = []
	for unit in units_root.find('Units'):
		id = unit.attrib['UnitType']

		if id in unique_list:
			continue
		if 'PrereqTech' not in unit.attrib:
			continue

		prereq = unit.attrib['PrereqTech']

		unit_obj = {
			'id': id,
			'requires': [prereq]
		}

		default_civ = 'CIVILIZATION_ALL'
		if id in unit_civs:
			default_civ = unit_civs[id]

		unit_obj[default_civ] = {
			'id': id,
			'name': unit_text[id]
		}

		if id in unique_units:
			for unique in unique_units[id]:
				unit_obj[unique['civ']] = {
					'id': unique['id'],
					'name': unit_text[unique['id']]
				}

		units.append(unit_obj)
		
	return units

def prep_civilizations(civilizations, text):
	'''Civilizations'''

	civ_types = civilizations.find('Civilizations')
	civ_list = []

	for civ in civ_types:
		if civ.attrib['StartingCivilizationLevelType'] != 'CIVILIZATION_LEVEL_FULL_CIV':
			continue

		civ_list.append({
			'id': civ.attrib['CivilizationType'],
			'name': text[civ.attrib['Description']]
		})

	return civ_list


base_civ_text = map_text('base', 'Text/en_US', 'Civilizations_Text')
base_types_text = map_text('base', 'Text/en_US', 'Types_Text')

raf_units_text = map_text('raf', 'Text/en_US', 'Expansion1_Units_text', 'EnglishText')
raf_config_text = map_text('raf', 'Text/en_US', 'Expansion1_ConfigText', 'EnglishText')

base_civilizations = get_root('base', '', 'Civilizations')
raf_civilizations = get_root('raf', '', 'Expansion1_Civilizations_Major')

base_civ_traits = get_civ_traits(base_civilizations)
raf_civ_traits = get_civ_traits(raf_civilizations)

base_projects = prep_projects('base', 'Projects')
base_improvements = prep_improvements('base')
base_buildings = prep_buildings('base', 'Buildings', base_civ_traits, base_types_text)
base_resources = prep_resources('base', base_types_text)
base_units = prep_units('base', 'Units', base_civ_traits, base_types_text)

if game == 'base':
	civ_data['technologies'] = prep_technologies(game)
	civ_data['projects'] = base_projects
	civ_data['improvements'] = base_improvements
	civ_data['buildings'] = base_buildings
	civ_data['resources'] = base_resources
	civ_data['units'] = base_units
	civ_data['civilizations'] = prep_civilizations(base_civilizations, base_civ_text)

elif game == 'raf':
	civs = base_civ_traits | raf_civ_traits
	types_text = base_types_text | raf_units_text | raf_config_text
	expansion1_buildings_text = map_text('raf', 'Text/en_US', 'Expansion1_Buildings_Text', 'EnglishText')
	expansion1_buildings = prep_buildings('raf', 'Expansion1_Buildings', raf_civ_traits, expansion1_buildings_text)
	expansion1_units = prep_units('raf', 'Expansion1_Units', civs, types_text)

	civ_data['technologies'] = prep_technologies(game)
	civ_data['projects'] = base_projects
	civ_data['improvements'] = base_improvements
	civ_data['buildings'] = base_buildings + expansion1_buildings
	civ_data['resources'] = base_resources
	civ_data['units'] = prep_units_new('raf', 'Units', 'Unit_Text')
	# civ_data['civilizations'] = prep_civilizations(raf_civilizations)


print(civ_data)
# Save to JSON

with open(f'{filename}.json', 'w') as fp:
	json.dump(civ_data, fp)