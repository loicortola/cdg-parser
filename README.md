# Karaoke Parser and Indexer


## Adding parser per folder logic
Each folder should have a custom parser.
This parser will tell the program how to parse each file name

Sample parser.json file
```json
{
  "pattern": "[0-9a-zA-Z]+ - (.*) - (.*)$", // Pattern allows you to customize the capturing groups
  "mapping": ["title", "artist"] // This tells which group to map to which entry. Available entries are : id, title, artist
}
```
