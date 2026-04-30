/**
 * Snap Trivia question bank.
 * MVP set: 60 evergreen questions across mixed categories.
 * Production target: 500+ with editor review.
 *
 * Schema is server-only; the client never receives `correctIndex`.
 */

export interface TriviaQuestion {
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  category: "pop" | "history" | "science" | "sports" | "geography";
  evergreen: boolean;
  difficulty: 1 | 2 | 3;
}

export const TRIVIA_QUESTIONS: readonly TriviaQuestion[] = [
  // Geography
  { prompt: "Which is the longest river in the world?", choices: ["Amazon", "Nile", "Yangtze", "Mississippi"], correctIndex: 1, category: "geography", evergreen: true, difficulty: 2 },
  { prompt: "Mount Everest sits on the border of Nepal and which other country?", choices: ["China", "India", "Bhutan", "Pakistan"], correctIndex: 0, category: "geography", evergreen: true, difficulty: 2 },
  { prompt: "Which country has the most time zones?", choices: ["United States", "Russia", "France", "Canada"], correctIndex: 2, category: "geography", evergreen: true, difficulty: 3 },
  { prompt: "What is the capital of Australia?", choices: ["Sydney", "Melbourne", "Canberra", "Perth"], correctIndex: 2, category: "geography", evergreen: true, difficulty: 2 },
  { prompt: "Which sea is the saltiest natural body of water on Earth?", choices: ["Dead Sea", "Red Sea", "Caspian Sea", "Lake Natron"], correctIndex: 3, category: "geography", evergreen: true, difficulty: 3 },
  { prompt: "Which African country was once known as Abyssinia?", choices: ["Eritrea", "Ethiopia", "Sudan", "Somalia"], correctIndex: 1, category: "geography", evergreen: true, difficulty: 2 },
  { prompt: "Which strait separates Europe and Africa?", choices: ["Bering", "Bosporus", "Gibraltar", "Hormuz"], correctIndex: 2, category: "geography", evergreen: true, difficulty: 2 },
  { prompt: "Which is the smallest country by area?", choices: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"], correctIndex: 2, category: "geography", evergreen: true, difficulty: 1 },
  { prompt: "Which desert is the largest hot desert in the world?", choices: ["Gobi", "Sahara", "Kalahari", "Atacama"], correctIndex: 1, category: "geography", evergreen: true, difficulty: 1 },
  { prompt: "Reykjavik is the capital of which country?", choices: ["Norway", "Sweden", "Iceland", "Finland"], correctIndex: 2, category: "geography", evergreen: true, difficulty: 1 },
  { prompt: "Which lake is the largest by surface area in the world?", choices: ["Lake Baikal", "Caspian Sea", "Lake Superior", "Lake Victoria"], correctIndex: 1, category: "geography", evergreen: true, difficulty: 2 },
  { prompt: "Which mountain range separates Europe from Asia?", choices: ["Alps", "Caucasus", "Urals", "Pyrenees"], correctIndex: 2, category: "geography", evergreen: true, difficulty: 2 },

  // Science
  { prompt: "What is the chemical symbol for gold?", choices: ["Go", "Au", "Ag", "Gd"], correctIndex: 1, category: "science", evergreen: true, difficulty: 1 },
  { prompt: "Which planet has the most moons currently confirmed?", choices: ["Jupiter", "Saturn", "Neptune", "Uranus"], correctIndex: 1, category: "science", evergreen: true, difficulty: 2 },
  { prompt: "What is the speed of light in a vacuum, approximately?", choices: ["300,000 km/s", "150,000 km/s", "1,000,000 km/s", "30,000 km/s"], correctIndex: 0, category: "science", evergreen: true, difficulty: 1 },
  { prompt: "Which gas makes up most of Earth's atmosphere?", choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"], correctIndex: 2, category: "science", evergreen: true, difficulty: 1 },
  { prompt: "What is the powerhouse of the cell?", choices: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"], correctIndex: 1, category: "science", evergreen: true, difficulty: 1 },
  { prompt: "How many bones are in the adult human body?", choices: ["186", "206", "226", "246"], correctIndex: 1, category: "science", evergreen: true, difficulty: 2 },
  { prompt: "What does DNA stand for?", choices: ["Deoxyribonucleic acid", "Dinitric acid", "Diribonucleic anion", "Deoxyriboside acid"], correctIndex: 0, category: "science", evergreen: true, difficulty: 1 },
  { prompt: "Which element has the atomic number 1?", choices: ["Helium", "Hydrogen", "Lithium", "Oxygen"], correctIndex: 1, category: "science", evergreen: true, difficulty: 1 },
  { prompt: "What is the hardest natural substance on Earth?", choices: ["Quartz", "Diamond", "Topaz", "Corundum"], correctIndex: 1, category: "science", evergreen: true, difficulty: 1 },
  { prompt: "What is the largest organ in the human body?", choices: ["Liver", "Brain", "Skin", "Heart"], correctIndex: 2, category: "science", evergreen: true, difficulty: 1 },
  { prompt: "What unit is used to measure electrical resistance?", choices: ["Volt", "Watt", "Ohm", "Ampere"], correctIndex: 2, category: "science", evergreen: true, difficulty: 2 },
  { prompt: "What is H2O more commonly known as?", choices: ["Salt", "Water", "Sugar", "Hydrogen"], correctIndex: 1, category: "science", evergreen: true, difficulty: 1 },

  // History
  { prompt: "In what year did the Berlin Wall fall?", choices: ["1987", "1988", "1989", "1991"], correctIndex: 2, category: "history", evergreen: true, difficulty: 2 },
  { prompt: "Who was the first President of the United States?", choices: ["Thomas Jefferson", "John Adams", "George Washington", "Benjamin Franklin"], correctIndex: 2, category: "history", evergreen: true, difficulty: 1 },
  { prompt: "The Great Wall of China was primarily built during which dynasty?", choices: ["Tang", "Ming", "Qing", "Han"], correctIndex: 1, category: "history", evergreen: true, difficulty: 2 },
  { prompt: "Which civilization built Machu Picchu?", choices: ["Aztec", "Maya", "Inca", "Olmec"], correctIndex: 2, category: "history", evergreen: true, difficulty: 1 },
  { prompt: "Who wrote the Communist Manifesto with Friedrich Engels?", choices: ["Vladimir Lenin", "Karl Marx", "Joseph Stalin", "Leon Trotsky"], correctIndex: 1, category: "history", evergreen: true, difficulty: 1 },
  { prompt: "Which country gifted the Statue of Liberty to the United States?", choices: ["United Kingdom", "France", "Spain", "Italy"], correctIndex: 1, category: "history", evergreen: true, difficulty: 1 },
  { prompt: "Cleopatra was the last active ruler of which kingdom?", choices: ["Persia", "Macedonia", "Ptolemaic Egypt", "Carthage"], correctIndex: 2, category: "history", evergreen: true, difficulty: 2 },
  { prompt: "World War I officially ended in which year?", choices: ["1916", "1917", "1918", "1919"], correctIndex: 2, category: "history", evergreen: true, difficulty: 1 },
  { prompt: "Who painted the ceiling of the Sistine Chapel?", choices: ["Raphael", "Donatello", "Michelangelo", "Leonardo da Vinci"], correctIndex: 2, category: "history", evergreen: true, difficulty: 1 },
  { prompt: "The Apollo 11 mission landed on the Moon in which year?", choices: ["1967", "1969", "1971", "1973"], correctIndex: 1, category: "history", evergreen: true, difficulty: 1 },
  { prompt: "Which empire was ruled by Genghis Khan?", choices: ["Roman", "Mongol", "Ottoman", "Persian"], correctIndex: 1, category: "history", evergreen: true, difficulty: 1 },
  { prompt: "The French Revolution began in which year?", choices: ["1776", "1789", "1804", "1812"], correctIndex: 1, category: "history", evergreen: true, difficulty: 2 },

  // Pop culture (evergreen — pre-2020 anchored)
  { prompt: "Which band recorded the album 'The Dark Side of the Moon'?", choices: ["Led Zeppelin", "Pink Floyd", "The Who", "The Rolling Stones"], correctIndex: 1, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "Who directed the original Jurassic Park (1993)?", choices: ["George Lucas", "Steven Spielberg", "Ridley Scott", "James Cameron"], correctIndex: 1, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "Which Beatles song begins 'Yesterday, all my troubles seemed so far away'?", choices: ["Let It Be", "Yesterday", "Hey Jude", "Imagine"], correctIndex: 1, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "Hogwarts School is featured in which book series?", choices: ["Lord of the Rings", "Narnia", "Harry Potter", "His Dark Materials"], correctIndex: 2, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "Who is the author of '1984' and 'Animal Farm'?", choices: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "Kurt Vonnegut"], correctIndex: 1, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "The character Tony Soprano is from which TV series?", choices: ["The Wire", "The Sopranos", "Breaking Bad", "Goodfellas"], correctIndex: 1, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "What is the highest-grossing film in the Studio Ghibli catalogue (pre-2020)?", choices: ["Princess Mononoke", "Spirited Away", "My Neighbor Totoro", "Howl's Moving Castle"], correctIndex: 1, category: "pop", evergreen: true, difficulty: 2 },
  { prompt: "In Star Wars, what color is Yoda's lightsaber?", choices: ["Blue", "Red", "Green", "Purple"], correctIndex: 2, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "Who painted the Mona Lisa?", choices: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Claude Monet"], correctIndex: 2, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "Which video game features a plumber rescuing a princess from Bowser?", choices: ["Sonic", "Mario", "Zelda", "Pac-Man"], correctIndex: 1, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "Who wrote 'A Brief History of Time'?", choices: ["Carl Sagan", "Neil deGrasse Tyson", "Stephen Hawking", "Richard Feynman"], correctIndex: 2, category: "pop", evergreen: true, difficulty: 1 },
  { prompt: "Which film features the line 'Here's looking at you, kid'?", choices: ["Citizen Kane", "Casablanca", "Gone with the Wind", "The Maltese Falcon"], correctIndex: 1, category: "pop", evergreen: true, difficulty: 2 },

  // Sports
  { prompt: "How many players are on a standard soccer team on the field?", choices: ["9", "10", "11", "12"], correctIndex: 2, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "Which sport uses terms 'love' and 'deuce'?", choices: ["Cricket", "Tennis", "Golf", "Badminton"], correctIndex: 1, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "The Tour de France is held primarily in which country?", choices: ["Italy", "Spain", "France", "Belgium"], correctIndex: 2, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "What is a perfect score in 10-pin bowling?", choices: ["100", "200", "250", "300"], correctIndex: 3, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "Which country invented the sport of judo?", choices: ["China", "Korea", "Japan", "Vietnam"], correctIndex: 2, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "How many holes are played in a standard round of golf?", choices: ["9", "12", "18", "27"], correctIndex: 2, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "In basketball, how many points is a free throw worth?", choices: ["1", "2", "3", "4"], correctIndex: 0, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "Which country has won the most FIFA World Cups?", choices: ["Germany", "Argentina", "Brazil", "Italy"], correctIndex: 2, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "The Stanley Cup is awarded in which sport?", choices: ["Baseball", "Basketball", "Ice Hockey", "American Football"], correctIndex: 2, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "What is the maximum score in a single dart throw on a standard board?", choices: ["50", "60", "100", "180"], correctIndex: 1, category: "sports", evergreen: true, difficulty: 2 },
  { prompt: "How long is an Olympic marathon?", choices: ["26.2 miles", "30 miles", "50 km", "10 km"], correctIndex: 0, category: "sports", evergreen: true, difficulty: 1 },
  { prompt: "Which sport is played at Wimbledon?", choices: ["Cricket", "Tennis", "Rugby", "Polo"], correctIndex: 1, category: "sports", evergreen: true, difficulty: 1 },
];

/** Server-only safe lookup. Never export `correctIndex` to client components. */
export function getTriviaQuestion(id: number): TriviaQuestion | undefined {
  return TRIVIA_QUESTIONS[id];
}

/** Public-shape: what the client receives. */
export interface PublicTriviaQuestion {
  id: number;
  prompt: string;
  choices: [string, string, string, string];
  category: TriviaQuestion["category"];
}

export function publicTriviaQuestion(id: number): PublicTriviaQuestion | undefined {
  const q = TRIVIA_QUESTIONS[id];
  if (!q) return undefined;
  return { id, prompt: q.prompt, choices: q.choices, category: q.category };
}
