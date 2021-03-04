# Data

This folder contains JSONs for each site-account pair.
Each JSON should be named as follows: `${site.id}${site.statements.account}.json`
eg. 'CHASEx1234.json'. Each JSON should contain the following data:

```
{
    latestDate: (string)
    type: (string)
}
```

-   latestDate: Date of last document on file, in ISO format, or empty quotes, (""), if no documents on file for this site-account.
-   type: Subfolder for classifying type of document eg. "Payslips" or "Statements". Assumes folder hierarchy as follows:

```
Finances
    |   -   Payslips
    |   -   Statements
```
