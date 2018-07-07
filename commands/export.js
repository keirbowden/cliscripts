/* 
    Subcommand to export the metadata from a Salesforce Org. Replicates
    the 'export' subcommand functionality from the Force.com CLI.
*/

var path = require("path");
var fse = require('fs-extra');
var child_process = require('child_process');

/*
 * Names of the metadata to retrieve
 */
const allMetadata=[
    "AccountSettings",
    "ActivitiesSettings",
    "AddressSettings",
    "AnalyticSnapshot",
    "ApexClass",
    "ApexComponent",
    "ApexPage",
    "ApexTrigger",
    "ApprovalProcess",
    "AssignmentRules",
    "AuraDefinitionBundle",
    "AuthProvider",
    "AutoResponseRules",
    "BusinessHoursSettings",
    "BusinessProcess",
    "CallCenter",
    "CaseSettings",
    "ChatterAnswersSettings",
    "CompanySettings",
    "Community",
    "CompactLayout",
    "ConnectedApp",
    "ContractSettings",
    "CustomApplication",
    "CustomApplicationComponent",
    "CustomField",
    "CustomLabels",
    "CustomMetadata",
    "CustomObject",
    "CustomObjectTranslation",
    "CustomPageWebLink",
    "CustomPermission",
    "CustomSite",
    "CustomTab",
    "DataCategoryGroup",
    "DuplicateRule",
    "EntitlementProcess",
    "EntitlementSettings",
    "EntitlementTemplate",
    "ExternalDataSource",
    "FieldSet",
    "Flow",
    "FlowDefinition",
    "Folder",
    "ForecastingSettings",
    "Group",
    "HomePageComponent",
    "HomePageLayout",
    "IdeasSettings",
    "KnowledgeSettings",
    "Layout",
    "Letterhead",
    "ListView",
    "LiveAgentSettings",
    "LiveChatAgentConfig",
    "LiveChatButton",
    "LiveChatDeployment",
    "MatchingRules",
    "MilestoneType",
    "MobileSettings",
    "NamedFilter",
    "Network",
    "OpportunitySettings",
    "PermissionSet",
    "Portal",
    "PostTemplate",
    "ProductSettings",
    "Profile",
    "ProfileSessionSetting",
    "Queue",
    "QuickAction",
    "QuoteSettings",
    "RecordType",
    "RemoteSiteSetting",
    "ReportType",
    "Role",
    "SamlSsoConfig",
    "Scontrol",
    "SecuritySettings",
    "SharingReason",
    "SharingRules",
    "Skill",
    "StaticResource",
    "Territory",
    "Translations",
    "ValidationRule",
    "Workflow"
];

function ExportCommand(opts) {
    this.options = opts;
    if (!this.options.directory) {
        this.options.directory='.';
    }

	try {
		var fstat=fse.statSync(this.options.directory);
	} catch (e) {
        fse.mkdirsSync(this.options.directory);
    }
    
    this.packageFilePath=path.join(this.options.directory, 'package.xml');
    if (!this.options.sfdxUser) {
        console.log('Missing -u (--username) parameter');
        process.exit(1);
    }
}

ExportCommand.prototype.execute = function () {
    console.log('Exporting metadata');
    var standardObjects=this.getStandardObjects();

    this.startPackage(); 
    for (var idx=0; idx<allMetadata.length; idx++) {
        var mdName=allMetadata[idx];
        this.startTypeInPackage();
        if (mdName=='CustomObject') {
            for (var soIdx=0; soIdx<standardObjects.length; soIdx++) {
                this.addPackageMember(standardObjects[soIdx]);
            }
        }
        this.addPackageMember('*');
        this.endTypeInPackage(mdName);
    }  

    this.endPackage();

    child_process.execFileSync('sfdx', 
                    ['force:mdapi:retrieve', 
                        '-u', this.options.sfdxUser, 
                        '-r', this.options.directory, 
                        '-k', this.packageFilePath]);
    
    console.log('Metadata written to ' + path.join(this.options.directory, 'unpackaged.zip'));
}

/*
 * Extract standard object names as these need to be explicitly named
 * when retrieving
 */
ExportCommand.prototype.getStandardObjects=function() {
    var standardObjectsObj=child_process.execFileSync('sfdx', 
                    ['force:schema:sobject:list', 
                        '-u', this.options.sfdxUser, 
                        '-c', 'standard']);

    var standardObjectsString=standardObjectsObj.toString();
    standardObjects=standardObjectsString.split('\n');

    for (var idx=standardObjects.length-1; idx>=0; idx--) {
    if ( (standardObjects[idx].endsWith('__Tag')) ||
         (standardObjects[idx].endsWith('__History')) ||
         (standardObjects[idx].endsWith('__Tags')) ) {
        standardObjects.splice(idx, 1);
        }
    }

    return standardObjects;
}

/*
 * Functions to write the package.xml manifest file
 * Will be refactored out if other commands need them
 */ 

ExportCommand.prototype.startPackage=function() {
    fse.writeFileSync(this.packageFilePath,
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n');
}

ExportCommand.prototype.endPackage=function() {
    fse.appendFileSync(this.packageFilePath,
         '  <version>43.0</version>\n' +
         '</Package>\n');
}
ExportCommand.prototype.addPackageMember = function(member) {
    fse.appendFileSync(this.packageFilePath, '    <members>' + member + '</members>\n');
}

ExportCommand.prototype.startTypeInPackage = function(cfg)
{
    fse.appendFileSync(this.packageFilePath, '  <types>\n');
}

ExportCommand.prototype.endTypeInPackage = function(name) {
    fse.appendFileSync(this.packageFilePath, '    <name>' + name + '</name>\n' +
                                         '  </types>\n');
}

module.exports=ExportCommand;