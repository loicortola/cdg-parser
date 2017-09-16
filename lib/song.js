class Song {
  
  constructor(id) {
    this.id = id || Song.nextId++; 
    this.artist = null;
    this.title = null;
  }
  
  getSongName() {
    return this.artist + ' -- ' + this.title;
  }
}

Song.nextId = 1;

module.exports = Song;