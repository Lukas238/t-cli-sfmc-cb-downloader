# t-cli-sfmc-cb-downloader

A command-line tool to automate downloading and backing up content assets from SFMC Content Builder to a local directory and Git repository.

**Important:** This tool downloads assets from explicitly defined folders and provides a one-way backup to Git. It does not recursively loop through subfolders.

## Features

- Downloads content assets (code snippets, HTML blocks, images, AMPscript, etc.) from specified SFMC folders.
- Saves assets to local directories as configured in the `config.json` file.
- Supports various asset types commonly used in email creation, including images, AMPscript, and HTML blocks.
- Configuration-driven: Easily specify which folders to download and where to save them.
- Automated execution: Designed to be run as a scheduled task (e.g., using `cron`) for daily updates.
- Optional Git Backup: Can be configured to automatically commit and push changes to a Git repository, providing a one-way backup.
- Detailed logging: Provides informative messages about the download process, including successes and errors.

## Usage

To run the tool, navigate to the directory where you want to download the content and use one of the following commands:

- **To download content only:**

  ```bash
  cbd
  ```

- **To download content and create a Git backup (if you've implemented the `--git-sync` argument in your `cbd.js` script):**

  ```bash
  cbd --git-sync
  ```

The tool will:

1.  Print the tool's name and version to the console.
2.  Load the configuration from `config.json`.
3.  Load the authentication credentials from `auth.json`.
4.  Connect to the SFMC API.
5.  Iterate through the folders defined in `config.json`.
6.  Download the assets from each folder to the specified local directory.
7.  Log the progress and any errors to the console.
8.  (If using `--git-sync`) Perform Git pull, add, commit, and push operations, creating a Git backup.

## Prerequisites

- **Node.js:** Make sure you have Node.js version 16 or higher installed. You can download it from [nodejs.org](https://nodejs.org/). Version 22 or higher is recommended.
- **Git:** Git is required for version controlling the downloaded assets and is needed if you want to use the Git backup feature. Install it from [git-scm.com](https://git-scm.com/).
- **SFMC API Credentials:** You will need valid SFMC API credentials for the tool to work.
- **SFMC API Permissions:** Ensure your API integration has the necessary permissions to access Content Builder assets.

## SFMC API Permissions

To successfully use this tool, ensure that your API integration has the following permissions granted in SFMC:

- **Channels:**
  - **Emails:** `Read`
- **Assets:**
  - **Documents and Images:** `Read & Write`
  - **Saved Content:** `Read & Write`

These permissions are essential for the tool to access and download content from your SFMC account.

### Obtaining SFMC API Credentials

To create an API integration and obtain the necessary credentials, follow the instructions in the Salesforce Marketing Cloud documentation: [Create an Installed Package](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/install_packages.htm). Make sure to grant the API integration the permissions listed above.

## Installation

This tool is designed to be installed globally as an npm package.

1.  **Install the package globally:**

  ```bash
  npm install -g t-cli-sfmc-cb-downloader
  ```

## Configuration

The tool uses two JSON configuration files: `config.json` and `auth.json`.

### 1. `config.json`

This file specifies the SFMC folders to download and the local directories to save the assets. It should be placed in the directory from which you will run the `cbd.js` script.

```json
{
"auth_file": "/path/to/secure/location/auth.json",
"contents": [
  {
    "folder_id": 33743,
    "local_path": "./my-sfmc-content"
  },
  {
    "folder_id": 12345,
    "local_path": "./another-sfmc-folder"
  }
]
}
```

- **`auth_file`:** (Required, string) The **absolute** path to the `auth.json` file (see below). This file should be stored in a secure location on your server, outside of the project directory.
- **`contents`:** (Required, array) An array of objects, where each object defines a folder to download.
  - **`folder_id`:** (Required, number) The ID of the folder in SFMC Content Builder.
  - **`local_path`:** (Required, string) The **relative** path to the local directory where the downloaded assets will be saved. This path is relative to the current working directory where you run the `cbd` command.

### 2. `auth.json`

This file contains your SFMC API credentials. **Keep this file secure and do not commit it to your repository.** It is recommended to create this file in a secure location, such as your user's home directory, rather than within the project directory.

```json
{
"auth_url": "https://your-sfmc-instance.auth.marketingcloudapis.com/",
"account_id": 123456789,
"bu_name": "Your Business Unit Name",
"client_id": "your-client-id",
"client_secret": "your-client-secret"
}
```

- **`auth_url`:** (Required, string) The authentication URL for your SFMC instance.
- **`account_id`:** (Required, number) Your SFMC account ID (also known as MID - Member ID). You can find this number in the SFMC user interface.
- **`bu_name`:** (Required, string) Your Business Unit Name in SFMC. This is the specific business unit you want to connect to.
- **`client_id`:** (Required, string) Your SFMC API client ID. You can generate this ID in the Installed Packages section of your SFMC account.
- **`client_secret`:** (Required, string) Your SFMC API client secret. This is generated along with the client ID and should be kept confidential.

**Important:** Ensure that the `auth_url` is correct for your SFMC stack. The `config.json` file should be placed in the same directory from which you intend to run the `cbd.js` script.

### Obtaining Folder IDs from SFMC Content Builder

To find the `folder_id` for a specific folder in SFMC Content Builder, you need to enable the "ID" column in the Content Builder view:

1.  Navigate to Content Builder in your SFMC account.
2.  Click on the "View" menu (usually represented by a gear icon or three dots).
3.  Select "Columns".
4.  Check the box next to "ID".

The "ID" column will now be displayed in the Content Builder folder view, showing the `folder_id` for each folder.

## Scheduling with Cron: Automate Content Updates (Optional Git Backup)

This tool can automate downloading content from SFMC. You can also schedule it to create a Git backup, preserving a history of your content.

1.  **Edit the crontab file on your server:**

  ```bash
  crontab -e
  ```

  If this is your first time using `cron`, you may be prompted to select an editor. Choose your preferred editor (e.g., `nano`).

2.  **Add a cron job:**

  Add a line to the crontab file that specifies the schedule and the command to execute.

  - **To download content only (without Git backup):**

      ```cron
      0 3 * * * cbd > debug.log 2>&1
      ```

  - **To download content and create a Git backup:**

      ```cron
      0 3 * * * cbd --git-sync > debug.log 2>&1
      ```

  **Explanation:**

  - `0 3 * * *`: This specifies the schedule (minute, hour, day of month, month, day of week). In this case, it means 3:00 AM every day. Use a cron expression generator (like [crontab.guru](https://crontab.guru/)) to create a schedule that meets your needs.
  - `cbd`: This assumes you have installed the `cbd.js` script globally using `npm install -g`. This calls the script globally.
  - `--git-sync`: This argument enables the Git backup feature.
  - `> debug.log 2>&1`: This redirects the output of the script to a log file named `debug.log` in the **current working directory**. This is important for monitoring the script's execution and identifying any errors. **Only the latest log will be keeped, as the file will be overwritten each time the script runs.**

**Important Considerations for Cron:**

- **Global Installation:** The cron job assumes the tool is installed globally (e.g., using `npm install -g`).
- **Git Synchronization Argument:** The `--git-sync` argument enables the Git backup feature.
- **Conditional Git Operations:** If you use the `--git-sync` argument, ensure that the user account running the cron job has properly configured Git credentials (username, email, and SSH key or password) to avoid authentication issues during the `git pull` and `git push` operations. **The script will also check if the current directory is a Git repository before attempting any Git operations.**
- **Branch Name:** The Git operations within the `cbd.js` script should be configured to use the correct branch name (e.g., `main`).
- **Logging:** Always redirect the output of your cron jobs to a log file. This will help you troubleshoot any problems.
- **Log File Location:** The log file (`debug.log`) will be created in the **current working directory** from which the cron job is executed.
- **Error Handling:** Consider adding robust error handling to your `cbd.js` script to gracefully handle any errors that may occur during execution, including Git-related errors.
- **Permissions:** Make sure the user account that runs the cron job has the necessary permissions to execute the script, write to the log file, and perform Git operations (if using `--git-sync`).

## Additional Setup (Windows/Mac Line Endings)

To ensure consistent behavior across Windows and macOS, run the following commands in your local repository:

```bash
git config --add --global core.filemode false
```

This command prevents Git from tracking file permission changes, which can cause unnecessary commits.

On macOS:

```bash
git config --global core.autocrlf input
```

On Windows:

```bash
git config --global core.autocrlf true
```

These commands handle line endings consistently across different operating systems. Windows uses CRLF (carriage return and line feed), while macOS and Linux use LF (line feed). Setting `core.autocrlf` to `input` on macOS and `true` on Windows ensures that line endings are converted correctly when committing and checking out files.

## Troubleshooting

- **"Invalid configuration"**: Check your `config.json` and `auth.json` files for syntax errors or missing required properties. The tool provides detailed error messages to help you identify the problem.
- **"SFMC API Error"**: Verify that your SFMC API credentials are correct and that your API integration has the necessary permissions.
- **"Permission denied"**: Make sure the `cbd.js` file is executable using `chmod +x cbd.js`. Also, ensure the user running the script has write permissions to the `local_path` directories defined in `config.json`.
- **"Not a git repository"**: If you are using the `--git-sync` option, ensure that you are running the command from within a valid Git repository.

## Contributing

Contributions are welcome! Please submit a pull request with your changes.

## License

This project is licensed under the MIT License.

Copyright (c) 2024 Lucas Dasso

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
