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

types_text = map_text(game, 'Text/en_US', 'Types_Text')

civilizations = get_root(game, '', 'Civilizations')

civ_types = civilizations.find('CivilizationTraits')
civ_types_dict = {}
for row in civ_types:
	civ_types_dict[row.attrib['TraitType']] = row.attrib['CivilizationType']

print(civ_types_dict)

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
	buildings_dict = {}


	# Need to support civ-specific buildings

	#
	for building in buildings_root.find('Buildings'):
		id = building.attrib['BuildingType']
		buildings_dict[id] = {
			'id': id,
			'cost': building.attrib['Cost'],
			'maintentance': building.attrib['Maintenance'],
			'name': types_text[building.attrib['Name']],
			'requires': [building.attrib['PrereqTech']]
		}

	

	




civ_data['technologies'] = prep_technologies(game)
civ_data['projects'] = prep_projects(game)
civ_data['improvements'] = prep_improvements(game)

# Save to JSON

with open(f'{filename}.json', 'w') as fp:
	json.dump(civ_data, fp)