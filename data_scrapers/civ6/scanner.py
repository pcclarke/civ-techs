import os
import json
import hashlib
from lxml import etree
from collections import defaultdict

class Civ6MetadataCatalog:
    def __init__(self, catalog_file="civ6_metadata_catalog.json"):
        self.catalog_file = catalog_file
        self.catalog = self._load_catalog()
    
    def _load_catalog(self):
        """Load existing catalog or create a new one"""
        if os.path.exists(self.catalog_file):
            with open(self.catalog_file, 'r') as f:
                return json.load(f)
        return {
            "files": {},
            "schemas": {},
            "relationships": {},
            "last_updated": None
        }
    
    def save_catalog(self):
        """Save the catalog to disk"""
        import datetime
        self.catalog["last_updated"] = datetime.datetime.now().isoformat()
        with open(self.catalog_file, 'w') as f:
            json.dump(self.catalog, f, indent=2)
    
    def analyze_file(self, file_path):
        """Analyze an XML file and add its metadata to the catalog"""
        if not os.path.exists(file_path) or not file_path.endswith('.xml'):
            return False
        
        file_info = {
            "path": file_path,
            "filename": os.path.basename(file_path),
            "size": os.path.getsize(file_path),
            "last_modified": os.path.getmtime(file_path),
            "expansion": self._detect_expansion(file_path),
            "file_type": None,
            "root_element": None,
            "schema_hash": None,
            "element_counts": {},
            "attributes": []
        }
        
        try:
            # Parse the XML
            tree = etree.parse(file_path)
            root = tree.getroot()
            
            # Basic info
            file_info["root_element"] = root.tag
            file_info["file_type"] = self._guess_file_type(file_path, root.tag)
            
            # Count elements
            element_counts = defaultdict(int)
            for elem in tree.iter():
                element_counts[elem.tag] += 1
            file_info["element_counts"] = dict(element_counts)
            
            # Collect attribute names
            attributes = set()
            for elem in tree.iter():
                for attr in elem.attrib:
                    attributes.add(attr)
            file_info["attributes"] = list(attributes)
            
            # Generate schema hash
            schema_structure = self._extract_schema_structure(root)
            schema_hash = hashlib.md5(json.dumps(schema_structure).encode()).hexdigest()
            file_info["schema_hash"] = schema_hash
            
            # Add schema to catalog if it's new
            if schema_hash not in self.catalog["schemas"]:
                self.catalog["schemas"][schema_hash] = {
                    "structure": schema_structure,
                    "files": []
                }
            
            # Add file to schema references
            if file_path not in self.catalog["schemas"][schema_hash]["files"]:
                self.catalog["schemas"][schema_hash]["files"].append(file_path)
            
            # Add to catalog
            self.catalog["files"][file_path] = file_info
            
            return True
            
        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")
            return False
    
    def _extract_schema_structure(self, element, max_depth=3, current_depth=0):
        """Extract a simplified schema structure for comparison"""
        if current_depth >= max_depth:
            return {"tag": element.tag, "has_children": len(element) > 0}
        
        children = {}
        for child in element:
            child_key = child.tag
            if child_key not in children:
                children[child_key] = self._extract_schema_structure(
                    child, max_depth, current_depth + 1
                )
        
        return {
            "tag": element.tag,
            "attributes": list(element.attrib.keys()),
            "children": children
        }
    
    def _detect_expansion(self, file_path):
        """Detect which expansion a file belongs to"""
        filename = os.path.basename(file_path)
        directory = os.path.dirname(file_path)
        
        if "Expansion1" in filename or "Expansion1" in directory:
            return "expansion1"
        elif "Expansion2" in filename or "Expansion2" in directory:
            return "expansion2"
        elif "DLC" in filename or "DLC" in directory:
            return "dlc"
        else:
            return "base"
    
    def _guess_file_type(self, file_path, root_tag):
        """Guess the type of data contained in the file"""
        filename = os.path.basename(file_path)
        
        # Check filename patterns
        patterns = {
            "Buildings": ["Building", "Buildings"],
            "Units": ["Unit", "Units"],
            "Technologies": ["Tech", "Techs", "Technology", "Technologies"],
            "Leaders": ["Leader", "Leaders"],
            "Civics": ["Civic", "Civics"],
            # Add more as needed
        }
        
        for data_type, keywords in patterns.items():
            for keyword in keywords:
                if keyword in filename:
                    return data_type
        
        # If not found in filename, use root tag
        return root_tag
    
    def scan_directory(self, directory_path):
        """Scan all XML files in a directory and its subdirectories"""
        file_count = 0
        for root, _, files in os.walk(directory_path):
            for file in files:
                if file.endswith('.xml'):
                    file_path = os.path.join(root, file)
                    if self.analyze_file(file_path):
                        file_count += 1
        
        self.find_relationships()
        self.save_catalog()
        return file_count
    
    def find_relationships(self):
        """Identify relationships between files based on common elements"""
        # Reset relationships
        self.catalog["relationships"] = {}
        
        # Group files by their root elements
        files_by_root = defaultdict(list)
        for file_path, file_info in self.catalog["files"].items():
            if file_info["root_element"]:
                files_by_root[file_info["root_element"]].append(file_path)
        
        # Look for references between files
        for file_path, file_info in self.catalog["files"].items():
            self.catalog["relationships"][file_path] = []
            
            # Files with the same root element might be related
            if file_info["root_element"] in files_by_root:
                for related_file in files_by_root[file_info["root_element"]]:
                    if related_file != file_path:
                        self.catalog["relationships"][file_path].append({
                            "file": related_file,
                            "relationship": "same_root_element",
                            "confidence": "medium"
                        })
    
    def suggest_parser_config(self):
        """Generate parser configuration based on the catalog"""
        config = {}
        
        # Group by file type
        for file_path, file_info in self.catalog["files"].items():
            file_type = file_info["file_type"]
            expansion = file_info["expansion"]
            
            if not file_type:
                continue
                
            if file_type not in config:
                config[file_type] = {}
            
            if expansion not in config[file_type]:
                # Get schema from this file
                schema_hash = file_info["schema_hash"]
                if schema_hash and schema_hash in self.catalog["schemas"]:
                    schema = self.catalog["schemas"][schema_hash]["structure"]
                    
                    # Try to determine the right parsing rules
                    root_tag = file_info["root_element"]
                    target_tags = []
                    ignore_tags = []
                    
                    # Look for Row elements which are common in Civ6 files
                    if "Row" in file_info["element_counts"]:
                        target_tags.append("Row")
                    
                    # Identify possible elements to ignore (like Update)
                    if "Update" in file_info["element_counts"]:
                        ignore_tags.append("Update")
                    
                    config[file_type][expansion] = {
                        "root": root_tag,
                        "target": target_tags[0] if target_tags else "Row",
                        "ignore": ignore_tags,
                        "schema_hash": schema_hash
                    }
        
        return config
    
    def get_file_info(self, file_path):
        """Get metadata for a specific file"""
        if file_path in self.catalog["files"]:
            return self.catalog["files"][file_path]
        return None
    
    def find_similar_files(self, file_path):
        """Find files with similar structure to the given file"""
        if file_path not in self.catalog["files"]:
            return []
        
        file_info = self.catalog["files"][file_path]
        schema_hash = file_info["schema_hash"]
        
        if not schema_hash or schema_hash not in self.catalog["schemas"]:
            return []
        
        return [f for f in self.catalog["schemas"][schema_hash]["files"] if f != file_path]
    
    def generate_report(self):
        """Generate a summary report of the catalog"""
        report = {
            "total_files": len(self.catalog["files"]),
            "total_schemas": len(self.catalog["schemas"]),
            "files_by_expansion": defaultdict(int),
            "files_by_type": defaultdict(int),
            "schema_groups": []
        }
        
        for file_info in self.catalog["files"].values():
            report["files_by_expansion"][file_info["expansion"]] += 1
            report["files_by_type"][file_info["file_type"]] += 1
        
        # List schemas with multiple files (potential templates)
        for schema_hash, schema_info in self.catalog["schemas"].items():
            if len(schema_info["files"]) > 1:
                report["schema_groups"].append({
                    "hash": schema_hash,
                    "file_count": len(schema_info["files"]),
                    "files": schema_info["files"][:5]  # First 5 for brevity
                })
        
        return report

catalog = Civ6MetadataCatalog()
catalog.scan_directory("./base")
catalog.scan_directory("./raf")
catalog.scan_directory("./gs")

report = catalog.generate_report()
print(f"Total files analyzed: {report['total_files']}")
print(f"Unique schema structures: {report['total_schemas']}")
print("\nFiles by expansion:")
for exp, count in report['files_by_expansion'].items():
    print(f" - {exp}: {count} files")

catalog.save_catalog()