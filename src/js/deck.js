var Deck = Backbone.Model.extend({
  decks: false,
  cards: false,
  currentCard: 0,
  defaults: { deckCount: 1, jokers: false, suits: [0, 1, 2, 3], seed: 0 },
  initialize: function() {
    this.decks = [];
    this.cards = [];
    this.configureDeck();
  },
  keys: {
    suits: ["Clubs", "Diamonds", "Hearts", "Spades"],
    cards: [
      "Joker",
      "Ace",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "Jack",
      "Queen",
      "King"
    ]
  },
  configureDeck: function(a) {
    for (var b = 0; b < this.get("deckCount"); b++) {
      this.addDeck();
    }
  },
  addDeck: function(e) {
    var a = [];
    var b = false;
    var h = false;
    var f = this.get("jokers");
    var c = this.get("suits");
    for (var d = 0; d < this.keys.cards.length; d++) {
      if (d == 0 && !f) {
        continue;
      }
      for (var g = 0; g <= c.length - 1; g++) {
        h = c[g];
        b = new Card({
          number: d,
          numberName: this.keys.cards[d],
          suitNum: h,
          suitName: this.keys.suits[h],
          visibility: false
        });
        a.push(b);
        this.cards.push(b);
      }
    }
    this.decks.push(a);
  },
  shuffle: function() {
    if (this.cards.length) {
      var c = this.cards.length;
      while (c--) {
        var a = this.msMaxRand(c + 1);
        var b = this.cards[c];
        this.cards[c] = this.cards[a];
        this.cards[a] = b;
      }
    }
    this.cards.reverse();
  },
  next: function() {
    if (typeof this.cards[this.currentCard] != "undefined") {
      return this.cards[this.currentCard++];
    }
    return false;
  },
  msRand: function() {
    this.set("seed", (this.get("seed") * 214013 + 2531011) & 2147483647);
    return (this.get("seed") >> 16) & 32767;
  },
  msMaxRand: function(a) {
    a = this.msRand() % a;
    return a;
  }
});
var Card = Backbone.Model.extend({
  defaults: { css: {} },
  initialize: function() {
    this.id = _.uniqueId("card-");
    this.set("css", {});
  },
  toString: function() {
    return this.get("numberName") + " of " + this.get("suitName");
  },
  getCssClass: function() {
    return (
      "card-" +
      this.get("numberName").toLowerCase() +
      "-" +
      this.get("suitName").toLowerCase()
    );
  },
  setCss: function(d, a) {
    var c = this.get("css");
    var b = false;
    var a = _.isUndefined(a) ? false : a;
    for (property in d) {
      if (_.isUndefined(c[property]) || c[property] != d[property]) {
        b = true;
      }
      c[property] = d[property];
    }
    c.immediate = a;
    if (b) {
      this.set("css", _.extend({}, c, d));
      this.trigger("change:css", this);
    } else {
    }
    return this;
  },
  getColor: function() {
    if (
      this.get("suitName") == "Hearts" ||
      this.get("suitName") == "Diamonds"
    ) {
      return "red";
    } else {
      return "black";
    }
  }
});
