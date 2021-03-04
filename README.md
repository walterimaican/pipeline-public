# Pipeline-Public

**This repo is a public version that has been stripped of private data. The purpose of making this public is to serve as inspiration or a basis for anyone wishing to create their own custom pipeline. This code is still _heavily_ in progress - use at your own caution.**

#

A highly customized pipeline to automate data transformation and backups.

Table of Contents

-   [Getting Started](#getting-started)
-   [Configurations](#configurations)
-   [Design Notes](#design-notes)

# Getting Started

Install `node` (must be version 14 or higher). You can do so either via [nvm](https://github.com/nvm-sh/nvm), [nvm-windows](https://github.com/coreybutler/nvm-windows) or downloading from [here](https://nodejs.org/en/download/).

Install packages:

```
npm i
```

Setup configurations - see the [Configurations](#configurations) section

Run (production):

```
npm run prod
```

Run (local development):

```
npm run dev
```

# Configurations

-   Make changes to `config/config.yaml`
-   Make changes to `config/sites-config.yaml`
-   Read `data/data_README.md` and add JSONs to `data/` as needed

## Documentation for config.yaml

-   Ensure that your Git credentials are setup correctly (for whenever logs are automatically pushed)
-   [Puppeteer](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#puppeteerlaunchoptions)
-   [Puppeteer-Cluster](https://github.com/thomasdondorf/puppeteer-cluster#usage)
-   [Puppeteer-Extra](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra#quickstart)
-   [Puppeteer-Extra-Plugin-User-Preferences](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-user-preferences)
-   [Chromium Flags](https://chromium.googlesource.com/chromium/src/+/master/chrome/common/pref_names.cc)

## Documentaton for sites-config.yaml

-   [Luxon Formatting](https://moment.github.io/luxon/docs/manual/parsing.html#table-of-tokens)

## Other dependencies

-   I personally use VeraCrypt to encrypt my sensitive data. This pipeline has steps to decrypt, read and write to the decrypted volume, and reencrypt. If you'd like to also use Veracrypt, please review its [documentation](https://www.veracrypt.fr/en/Introduction.html) as well the [documentation for the CLI](https://www.veracrypt.fr/en/Command%20Line%20Usage.html).

-   I personally use rclone to sync backups to both a local drive and a cloud backup. If you'd like to use rclone, please review the [documentation](https://rclone.org/).

-   For handling photos/videos, [exiftool](https://exiftool.org/) is used.

-   Some Bash shell scripts are used - I personally use [CMDer](https://cmder.net/) and have it integrated with VS Code.

-   This pipeline was developed for use on a Windows OS. Please make changes as needed if using Linux or Mac OS.

# Design Notes

## Why use rclone over S3 SDK?

-   Rclone can sync changes alone and it is possible to build for multiple endpoints with rclone, including the local file system (which S3 cannot do).

## Why use B2 native API vs B2 implementation of the S3 API/protocol?

-   Per blogposts from BackBlaze, their B2 S3 API could share load with tons of other traffic in one pipe. Compare that to how the native B2 API communicates to the server and then points directly to the right endpoint. Theoretically, there should be less load-balancing issues.

-   Additionally, adapting the code that uses rclone for the B2 native API vs S3 compatible API is a simple matter of reading the documentation and designing accordingly. If you wish to connect to multiple cloud vendors that use the S3 protocol, feel free to adapt for the S3 SDK.

## Why rclone vs B2 CLI when syncing?

-   Per documentation, the B2 CLI will try once but not retry automatically if there is an error, as opposed to rclone, which will reattempt syncs as needed.

## Why have a wrapper around the main process?

-   I wanted a way to log during execution and have those logs saved for review in case they are needed. I decided on having those logs saved with the project itself instead of having them separate.
-   In order to do this, I needed a way to automate saving those logs. Logs are not created until after the main process ends, hence the need for a wrapper to handle saving those logs separately.

## Why save the logs with the project? Why not have them saved in a separate repository?

-   Given that the logs are mainly intended for personal use and review and usually only in the event that something goes wrong, there is no need for these logs to endure in an enterprise-level medium like an ECS container. The priority should be ease of access without excess bloat.
-   Although the project's sourcecode is "updated" on every production run, it allows the user to access and review logs with their GitHub and keeps it all in one place without extra steps or charge.

## Why are there only unit tests?

-   This pipeline is as it sounds: data (and actions) flow one way. In essence, this program is a glorified script. For this reason, functional tests would effectively be a production run. Performance tests are not needed as the intent for this pipeline is for personal use (and I would personally use this on a monthly basis, at most weekly). Unit tests ensure that changes made do not break existing functionality.

## Why use the synchronous versions of fs apis vs the async versions?

-   The question of async vs sync comes down to whether a particular section of the program must/should run in parallel or if some other code can/should run at the same time as the method in question. The points in the program where a file operation is needed show that the continuation of the program depends on the results of the file. For this reason, using the sync versions lead to more simplicity and faster execution. Simply put, there is no need for them to be async.

## Why copy photos via USB vs Google Photos API?

-   The Google Photos API has some limitations that I consider breaking enough to not use it. First, photos/videos downloaded via the API have their location metadata stripped. This has been an issue for years and it is clear that Google does not intend to fix this. Secondly, there is no way to delete photos/videos via the API. After consideration, I decided that the use of Google Photos for me personally, is use as a backup: in the event my phone is lost/stolen, precious pictures/videos will still be backed up to the cloud in realtime. In a normal use case, I can transfer this data via USB and then delete from Google Photos (so I don't exceed the 15 GB limit).
