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
    "Dashboard",
    "DuplicateRule",
    "EmailTemplate",
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
    "Report",
    "Role",
    "SamlSsoConfig",
    "Scontrol",
    "SecuritySettings",
    "SharingReason",
    "SharingCriteriaRule",
    "SharingOwnerRule",
    "SharingTerritoryRule",
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
    this.getFolderMetadata();
    var standardObjects=this.getStandardObjects();
    this.startPackage(); 
    for (var idx=0; idx<allMetadata.length; idx++) {
        var mdName=allMetadata[idx];
        this.startTypeInPackage();
        switch(mdName) {
            case 'Dashboard':
                var dbFolders=this.foldersByType['Dashboard'];
                for (var folderId in dbFolders) {
                    if (dbFolders.hasOwnProperty(folderId)) {
                        var folder=dbFolders[folderId];
                        this.addPackageMember(folder.Name);
                        for (var dbIdx=0; dbIdx<folder.members.length; dbIdx++) {
                            var dashboard=folder.members[dbIdx];
                            this.addPackageMember(folder.Name + '/' + dashboard.DeveloperName);
                        }
                    }
                }
                break;
            case 'EmailTemplate':
                var etFolders=this.foldersByType['Email'];
                for (var folderId in etFolders) {
                    if (etFolders.hasOwnProperty(folderId)) {
                        var folder=etFolders[folderId];
                        this.addPackageMember(folder.Name);
                        for (var etIdx=0; etIdx<folder.members.length; etIdx++) {
                            var emailTemplate=folder.members[etIdx];
                            this.addPackageMember(folder.Name + '/' + emailTemplate.DeveloperName);
                        }
                    }
                }
                break;
            case 'Report':
                var repFolders=this.foldersByType['Report'];
                for (var folderId in repFolders) {
                    if (repFolders.hasOwnProperty(folderId)) {
                        var folder=repFolders[folderId];
                        this.addPackageMember(folder.Name);
                        for (var repIdx=0; repIdx<folder.members.length; repIdx++) {
                            var report=folder.members[repIdx];
                            this.addPackageMember(folder.Name + '/' + report.DeveloperName);
                        }
                    }
                }
                break;
            case 'CustomObject': 
                for (var soIdx=0; soIdx<standardObjects.length; soIdx++) {
                    this.addPackageMember(standardObjects[soIdx]);
                }
            default:
                this.addPackageMember('*');
        }
        this.endTypeInPackage(mdName);
    }  

    this.endPackage();

    console.log('Extracting metadata');
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

ExportCommand.prototype.getFolderMetadata = function() {
    this.buildFolderStructure();
    this.getReports(); 
    this.getDashboards(); 
    this.getEmailTemplates(); 
}

ExportCommand.prototype.buildFolderStructure = function() {
    let query="Select Id, Name, DeveloperName, Type, NamespacePrefix from Folder where DeveloperName!=null";
    let foldersJSON=child_process.execFileSync('sfdx', 
        ['force:data:soql:query',
            '-q', query, 
            '-u', this.options.sfdxUser,
            '--json']);

    let folders=JSON.parse(foldersJSON);
    this.foldersByType={'Dashboard':{},
                       'Report':{}, 
                       'Email':{}}

    for (var idx=0; idx<folders.result.records.length; idx++) {
        var folder=folders.result.records[idx];
        var foldersForType=this.foldersByType[folder.Type];
        if (foldersForType) {
            if (!foldersForType[folder.Id]) {
                foldersForType[folder.Id]={'Name': folder.DeveloperName, 'members': []};
            }
        }
    }
}

ExportCommand.prototype.getReports = function() {
    let query="Select Id, DeveloperName, OwnerId from Report";
    let reportsJSON=child_process.execFileSync('sfdx', 
        ['force:data:soql:query',
            '-q', query, 
            '-u', this.options.sfdxUser,
            '--json']);

    let reports=JSON.parse(reportsJSON);

    for (var idx=0; idx<reports.result.records.length; idx++) {
        var report=reports.result.records[idx];
        var foldersForReports=this.foldersByType['Report'];
        var folderForThisReport=foldersForReports[report.OwnerId];
        if (folderForThisReport) {
            folderForThisReport.members.push(report);
        }
    }
}

ExportCommand.prototype.getDashboards = function() {
    let query="Select Id, DeveloperName, FolderId from Dashboard";
    let dashboardsJSON=child_process.execFileSync('sfdx', 
        ['force:data:soql:query',
            '-q', query, 
            '-u', this.options.sfdxUser,
            '--json']);

    let dashboards=JSON.parse(dashboardsJSON);

    for (var idx=0; idx<dashboards.result.records.length; idx++) {
        var dashboard=dashboards.result.records[idx];
        var foldersForDashboards=this.foldersByType['Dashboard'];
        var folderForThisDashboard=foldersForDashboards[dashboard.FolderId];
        if (folderForThisDashboard) {
            folderForThisDashboard.members.push(dashboard);
        }
    }
}

ExportCommand.prototype.getEmailTemplates = function() {
    let query="Select Id, DeveloperName, FolderId from EmailTemplate";
    let templateJSON=child_process.execFileSync('sfdx', 
        ['force:data:soql:query',
            '-q', query, 
            '-u', this.options.sfdxUser,
            '--json']);

    let templates=JSON.parse(templateJSON);

    for (var idx=0; idx<templates.result.records.length; idx++) {
        var template=templates.result.records[idx];
        var foldersForTemplates=this.foldersByType['Email'];
        var folderForThisTemplate=foldersForTemplates[template.FolderId];
        if (folderForThisTemplate) {
            folderForThisTemplate.members.push(template);
        }
    }
}

module.exports=ExportCommand;