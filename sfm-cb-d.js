#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import utils from './_utils.js';
import { exec } from 'child_process'; // Import exec for running Git commands
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

// Define a global variable to store the config and auth data
var configData = null;

const configFileName = 'config.json'; // Default config file name
const configFilePath = path.join(process.cwd(), configFileName); // Look for the config file in the current working directory

/**
* Defines the default configuration schema.  This is a JS object that describes
* the expected structure and types of the configuration data.
*/
const defaultConfigSchema = {
 auth_file: { type: 'string', required: true, description: 'Path to the authentication file' },
 contents: {
   type: 'array',
   required: true,
   description: 'Array of content configurations',
   elementSchema: { // Schema for each element in the array
     folder_id: { type: 'number', required: true, description: 'SFMC Folder ID' },
     local_path: { type: 'string', required: true, description: 'Relative path to the local directory' }
   }
 }
};

/**
* Defines the default authentication schema.
*/
const defaultAuthSchema = {
 auth_url: { type: 'string', required: true, description: 'Authentication URL' },
 account_id: { type: 'number', required: true, description: 'Account ID' },
 bu_name: { type: 'string', required: true, description: 'Business Unit Name' },
 client_id: { type: 'string', required: true, description: 'Client ID' },
 client_secret: { type: 'string', required: true, description: 'Client Secret' }
};

/**
* Executes a shell command.
*
* @param {string} command - The command to execute.
* @param {object} options - Options for the exec command (cwd).
* @returns {Promise<string>} - A promise that resolves with the command output or rejects with an error.
*/
function execAsync(command, options = {}) {
 return new Promise((resolve, reject) => {
   exec(command, options, (error, stdout, stderr) => {
     if (error) {
       reject(error);
       return;
     }
     resolve(stdout);
   });
 });
}

/**
* Checks if a directory is a Git repository.
* @param {string} directoryPath - The path to the directory.
* @returns {Promise<boolean>} - A promise that resolves with true if the directory is a Git repository, false otherwise.
*/
async function isGitRepository(directoryPath) {
 try {
   await execAsync('git rev-parse --is-inside-work-tree', { cwd: directoryPath });
   return true;
 } catch (error) {
   return false;
 }
}

async function init() {
 let packageJson;

 try {
   const data = fs.readFileSync(__dirname + '/package.json', 'utf8');
   packageJson = JSON.parse(data);
 } catch (err) {
   utils.logger.error("Failed to read package.json:", err);
   return false;
 }

 // Print the CLI tool version
 utils.logger.info(`${packageJson.name} v${packageJson.version}`);

 configData = utils.loadAndValidateConfigs(configFilePath, defaultConfigSchema, defaultAuthSchema);

 if (!configData) {
   utils.logger.error("Configurations are invalid.");
   return false;
 }

 // Check if the --git-sync argument is present
 const gitSync = process.argv.includes('--git-sync');

 const cwd = process.cwd(); // Get the current working directory

 // Perform Git operations if --git-sync is present
 if (gitSync) {
   // Check if the current directory is a Git repository
   if (!await isGitRepository(cwd)) {
     utils.logger.error("The current directory is not a Git repository. Git synchronization aborted.");
     return false;
   }

   try {
     utils.logger.info("Performing Git pull...");
     await execAsync('git pull origin main', { cwd }); // Adjust branch name if needed
     utils.logger.info("Git pull completed.");
   } catch (error) {
     utils.logger.error("Git pull failed:", error);
     return false; // Stop if Git pull fails
   }
 }

 // Asset content source
 const asset_source_content = 1;
 const asset_source_downloadable = 2;

 // Create a SFMC connection
 const sfmc_conn = utils.sfmc_conn(configData.auth);

 // Loop the folders

 for (let i = 0; i < configData.config.contents.length; i++) {
   const folder = configData.config.contents[i];

   // Use path.resolve to create an absolute path from cwd and relative local_path
   const absoluteLocalPath = path.resolve(cwd, folder.local_path);

   // Extract folder name from local_path
   const folderName = path.basename(folder.local_path);

   // Check if local_path exist, and if not, create it
   if (!fs.existsSync(absoluteLocalPath)) {
     utils.logger.info(`Creating local folder for '${folderName ?? '#' + i}'.`);
     fs.mkdirSync(absoluteLocalPath, { recursive: true });
   }
   var folder_contents = null;
   // Get the folder contents
   try {
     folder_contents = await sfmc_conn.rest.get(`/asset/v1/content/assets?$filter=category.id eq ${folder.folder_id}&$fields=id,name,content,fileProperties&scope=Ours,Shared`);

   } catch (error) {
     utils.logger.error(`Error getting folder content for '${folderName}'.`, error);
     continue;
   }

   // Print folder info
   /*
    Folder list format:
    ```jsonı
    {
       count: 18,
       page: 1,
       pageSize: 50,
       links: {},
       items: [
           {
             id: 116287,
             customerKey: 'f15e1942-e057-4b80-a8b1-e61d7440e8ad',
             assetType: {
               id: 220,
               name: 'codesnippetblock',
               displayName: 'Code Snippet Block'
             },
             name: 'MMP_BODY_ACCOUNT_INFO_SILVER',
             content: '[HTML HERE]',
             fileProperties: {
               "fileName": "status_bar_desktop.jpg",
               "extension": "jpg",
               "fileSize": 4338,
               "fileCreatedDate": "2024-08-13T11:31:55.8598384-06:00",
               "width": 1340,
               "height": 16,
               "publishedURL": "https://image.enews.united.com/lib/fe36117371640475761670/m/1/status_bar_desktop.jpg"
             }
           }
         ]
       }
     ´´´
    */

   // ToDo: Make sure we download all files in this page and additional pages if needed.

   folder_contents.items.forEach(item => {
     const ext = utils.get_asset_file_extension(item.assetType.id);
     var file_name = null;

     // Check if is a content or a downlodable file
     var asset_source_type = null;

     // Check if asset is a content asset
     if (item.hasOwnProperty('content')) {
       asset_source_type = asset_source_content;
     }

     // Check if asset is a downlodable asset with publishedURL name and ext
     if (item.hasOwnProperty('fileProperties') && item.fileProperties.hasOwnProperty('publishedURL') && item.fileProperties.hasOwnProperty('fileName') && item.fileProperties.hasOwnProperty('extension')) {
       asset_source_type = asset_source_downloadable;
     }

     // If asset is not a content or a downloadable file, skip it
     if (asset_source_type == null) {
       utils.logger.info(`Skipping asset '${item.name}' as it is not a content or a downloadable file.`);
       return;
     }

     // Download or write down the asset source data
     switch (asset_source_type) {
       case asset_source_content:
         file_name = `${item.name}.${ext}`;
         utils.asset_write(item.content, absoluteLocalPath, file_name);
         break;
       case asset_source_downloadable:
         file_name = item.fileProperties.fileName; // this already includes the file ext
         utils.asset_download(item.fileProperties.publishedURL, absoluteLocalPath, file_name);
         break;
     }

     utils.logger.info(`Downloaded asset '${file_name}'.`);
   });

 };

 // Perform Git operations if --git-sync is present
 if (gitSync) {
   try {
     utils.logger.info("Performing Git add, commit, and push...");
     await execAsync('git add .', { cwd });
     await execAsync('git commit -m "Daily SFMC Content Update"', { cwd });
     await execAsync('git push origin main', { cwd }); // Adjust branch name if needed
     utils.logger.info("Git add, commit, and push completed.");
   } catch (error) {
     utils.logger.error("Git add, commit, or push failed:", error);
     return false; // Stop if Git operations fail
   }
 }

}

init();
