# CD-G Parser and Indexer

I know this is not the usual project... But since you're asking:
The CD-G Parser allows you to build a great quality index and reconvention all your CD-G files.
If you are used to (legally) download your CD-G content, you may have encountered this.
Thousands of songs make it hard to keep up with the index, and keep your files clean and without duplicates.

## Environment
You need to have node and npm (node package manager) installed.

Once this is done, clone the repository and inside the directory, type ```npm install```.

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

Run the sample in the input directory by using ```node index```