import SDK from 'sfmc-sdk';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';


const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

const logLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const default_file_ext = 'ampscript';

const asset_types = JSON.parse(fs.readFileSync(__dirname + path.sep + 'asset_types.json', 'utf8'));

const utils = {
  /**
   * logger
   *
   * This function create a winston logger
   *
   * Example:
   * ```js
   *  logger.info("System launch"); // {"message":"System launch","level":"info"}
   *  logger.fatal("A critical failure!"); // {"message":"A critical failure!","level":"fatal"}"
   * ```
   */
  'logger': pino({
    transport: {
      target: 'pino-pretty',
      options: {
        ignore: 'pid,hostname',
        translateTime: 'yy-mm-dd HH:ss.l'
      }
    },
  }),

  /**
   * deepMerge
   *
   * This function merge two objects recursively
   *
   * Example: "const deepMergedObj = deepMerge(obj1, obj2);"
   */
  'deepMerge': function (obj1, obj2) {
    for (let key in obj2) {
      if (obj2.hasOwnProperty(key)) {
        if (obj2[key] instanceof Object && obj1[key] instanceof Object) {
          obj1[key] = deepMerge(obj1[key], obj2[key]);
        } else {
          obj1[key] = obj2[key];
        }
      }
    }
    return obj1;
  },

  /**
   * sfmc_conn
   *
   * This function set the connection to the SFMC instance
   */
  'sfmc_conn': function (sfmc_auth = null) {


    if (sfmc_auth == null) {
      const err = new Error("[sfmc_conn] Missing configuration data.");
      this.logger.error(err.stack);
      return false;
    }

    return new SDK(
      {
        client_id: sfmc_auth.client_id,
        client_secret: sfmc_auth.client_secret,
        auth_url: sfmc_auth.auth_url,
        account_id: sfmc_auth.account_id
      },
      {
        eventHandlers: {
          onLoop: (type, accumulator) => this.logger.info('Looping...'),
          onConnectionError: (ex, remainingAttempts) => this.logger.error(ex.code)
        },
        requestAttempts: 1,
        retryOnConnectionError: true
      }
    )
  },
  'get_asset_file_extension': function (asset_type_id = null) {
    // If asset type is found, return the ext value, if not return a txt value as fallback
    return asset_types[asset_type_id] ? asset_types[asset_type_id].ext : default_file_ext;
  },
  'remove_content_wrapper': function (content = null,) {
    // This function remove the content SFMC added table>tr>td wrapper from the content code

    // If the content do not start with the SFMC specific wrap table>tr>td, return the content as is
    if (!/^<table.*?role="presentation".*?class="stylingblock-content-wrapper".*?><tr><td.*?class="stylingblock-content-wrapper camarker-inner".*?>/.test(content) ){
      return content;
    }

    // Remove the content table>tr>td wrapper from the start of the content, and the corresponding </td></tr></table> from the end of the content
    return content.replace(/^<table.*?role="presentation".*?class="stylingblock-content-wrapper".*?><tr><td.*?class="stylingblock-content-wrapper camarker-inner".*?>|<\/td><\/tr><\/table>$/sg, '');

  },
  'asset_write': async function (content = null, folder_path = null, file_name = null) {
    const fullname = `${folder_path}${path.sep}${file_name}`;

    // Check if this content file name is an html file
    if ( ['.htmlblock'].includes(path.extname(file_name).toLowerCase())) {
      content = utils.remove_content_wrapper(content); // Remove the content table>tr>td wrapper from the content
    }

    fs.writeFileSync(fullname, content);
  },
  'asset_download': async function (url = null, folder_path = null, file_name = null) {
    const fullname = `${folder_path}${path.sep}${file_name}`;

    var file = fs.createWriteStream(fullname);
    return https.get(url, function (response) {
      response.pipe(file);
      file.on('finish', function () {
        file.close();  // close() is async, call cb after close completes.
        utils.logger.info(`Downloaded asset '${file_name}'.`);
        return true;
      });
    }).on('error', function (err) { // Handle errors
      fs.unlink(fullname); // Delete the file async. (But we don't check the result)
      utils.logger.error(err.message);
      return false;
    });


  },
  'loadConfigFile': function(filePath, fileDescription) {
   if (!fs.existsSync(filePath)) {
     utils.logger.error(`[File] The ${fileDescription} file '${filePath}' was not found.`);
     return null;
   }

   try {
     return JSON.parse(fs.readFileSync(filePath, 'utf8'));
   } catch (error) {
     utils.logger.error(`[File] The ${fileDescription} file '${filePath}' is not a valid JSON file.`, error);
     return null;
   }
  },

  'validateDataAgainstSchema': function(data, schema, configName = 'Config', propertyPath = '') {
   for (const key in schema) {
     if (!schema.hasOwnProperty(key)) continue;

     const propertySchema = schema[key];
     const propertyValue = data[key];
     const currentPath = propertyPath ? `${propertyPath}.${key}` : key; // Build the property path

     // Check if the property is required and missing
     if (propertySchema.required && !data.hasOwnProperty(key)) {
       utils.logger.error(`[${configName}] The required property '${currentPath}' was not found. Description: ${propertySchema.description || 'No description provided.'}`);
       return false;
     }

     // If the property is not present and not required, skip validation
     if (!data.hasOwnProperty(key)) {
       continue;
     }

     // Type checking
     if (propertySchema.type) {
       const expectedType = propertySchema.type;
       let actualType = typeof propertyValue;

       if (Array.isArray(propertyValue)) {
         actualType = 'array';
       }

       if (actualType !== expectedType) {
         utils.logger.error(`[${configName}] The property '${currentPath}' should be of type '${expectedType}' but found '${actualType}'. Description: ${propertySchema.description || 'No description provided.'}`);
         return false;
       }
     }

     // Additional validation for arrays
     if (propertySchema.type === 'array') {
       if (propertySchema.elementSchema) {
         if (!Array.isArray(propertyValue)) {
           utils.logger.error(`[${configName}] The property '${currentPath}' should be an array. Description: ${propertySchema.description || 'No description provided.'}`);
           return false;
         }
         // Validate each element in the array against the elementSchema
         for (let i = 0; i < propertyValue.length; i++) {
           const element = propertyValue[i];
           if (!utils.validateDataAgainstSchema(element, propertySchema.elementSchema, configName, `${currentPath}[${i}]`)) {
             return false; // Stop if any element is invalid
           }
         }
       } else {
         utils.logger.warn(`[${configName}] The array property '${currentPath}' has no elementSchema defined.  Skipping element validation.`);
       }
     }
   }

   return true; // All checks passed
  },

  'loadAndValidateConfigs': function(configFilePath, defaultConfigSchema, defaultAuthSchema) {
   // 1. Load the main configuration file
   const config = utils.loadConfigFile(configFilePath, "main configuration");
   if (!config) {
     return false;
   }

   // 2. Validate the main configuration against the default schema
   if (!utils.validateDataAgainstSchema(config, defaultConfigSchema, 'Main Config')) {
     return false;
   }

   // 3. Load the authentication file (path from the main config)
   const authFilePath = config.auth_file;
   if (!authFilePath) {
     utils.logger.error("[Config] The 'auth_file' property is missing in the main configuration.");
     return false;
   }

   const authData = utils.loadConfigFile(authFilePath, "authentication");
   if (!authData) {
     return false;
   }

   // 4. Validate the authentication data against the default schema
   if (!utils.validateDataAgainstSchema(authData, defaultAuthSchema, 'Auth Config')) {
     return false;
   }

   // All checks passed
   return { config: config, auth: authData };
  }
};

export default utils;
