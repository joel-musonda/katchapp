export interface TriviaQuestion {
  category: string;
  question: string;
  options: string[];
  correct: number;
}

export const triviaQuestions: TriviaQuestion[] = [
  { category: 'Science', question: 'What planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1 },
  { category: 'Science', question: 'What is the chemical symbol for water?', options: ['H2O', 'CO2', 'NaCl', 'O2'], correct: 0 },
  { category: 'Science', question: 'How many bones are in the adult human body?', options: ['186', '206', '226', '246'], correct: 1 },
  { category: 'Science', question: 'What gas do plants absorb?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correct: 2 },
  { category: 'Science', question: 'What is the largest organ in the human body?', options: ['Heart', 'Brain', 'Liver', 'Skin'], correct: 3 },
  { category: 'Science', question: 'What is the speed of light approximately?', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '1,000,000 km/s'], correct: 0 },
  { category: 'History', question: 'In what year did World War II end?', options: ['1943', '1944', '1945', '1946'], correct: 2 },
  { category: 'History', question: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Donatello'], correct: 1 },
  { category: 'History', question: 'Who first walked on the Moon?', options: ['Buzz Aldrin', 'Yuri Gagarin', 'Neil Armstrong', 'John Glenn'], correct: 2 },
  { category: 'History', question: 'The Berlin Wall fell in which year?', options: ['1987', '1988', '1989', '1990'], correct: 2 },
  { category: 'History', question: 'Which empire built the Colosseum?', options: ['Greek', 'Roman', 'Ottoman', 'Persian'], correct: 1 },
  { category: 'History', question: 'Who invented the telephone?', options: ['Edison', 'Tesla', 'Bell', 'Marconi'], correct: 2 },
  { category: 'Geography', question: 'What is the largest continent by area?', options: ['Africa', 'North America', 'Europe', 'Asia'], correct: 3 },
  { category: 'Geography', question: 'Which country has the most natural lakes?', options: ['USA', 'Russia', 'Canada', 'Brazil'], correct: 2 },
  { category: 'Geography', question: 'What is the smallest country in the world?', options: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], correct: 1 },
  { category: 'Geography', question: 'Which river is the longest in the world?', options: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], correct: 1 },
  { category: 'Geography', question: 'Mount Everest is in which mountain range?', options: ['Andes', 'Alps', 'Rockies', 'Himalayas'], correct: 3 },
  { category: 'Geography', question: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], correct: 2 },
  { category: 'Entertainment', question: 'Who directed Jurassic Park?', options: ['James Cameron', 'Steven Spielberg', 'George Lucas', 'Ridley Scott'], correct: 1 },
  { category: 'Entertainment', question: 'What band performed "Bohemian Rhapsody"?', options: ['The Beatles', 'Led Zeppelin', 'Queen', 'Pink Floyd'], correct: 2 },
  { category: 'Entertainment', question: 'In which year was the first iPhone released?', options: ['2005', '2006', '2007', '2008'], correct: 2 },
  { category: 'Entertainment', question: 'Who wrote the Harry Potter series?', options: ['J.R.R. Tolkien', 'C.S. Lewis', 'J.K. Rowling', 'Roald Dahl'], correct: 2 },
  { category: 'Entertainment', question: 'What is the highest-grossing film ever?', options: ['Avengers: Endgame', 'Avatar', 'Titanic', 'Star Wars'], correct: 1 },
  { category: 'Entertainment', question: 'What video game features Mario?', options: ['Sonic', 'Zelda', 'Super Mario Bros', 'Pac-Man'], correct: 2 },
  { category: 'Sports', question: 'How many players on a soccer team?', options: ['9', '10', '11', '12'], correct: 2 },
  { category: 'Sports', question: 'In which sport is "love" a score?', options: ['Badminton', 'Tennis', 'Golf', 'Cricket'], correct: 1 },
  { category: 'Sports', question: 'How many rings on the Olympic flag?', options: ['3', '4', '5', '6'], correct: 2 },
  { category: 'Sports', question: 'Which country won 2018 FIFA World Cup?', options: ['Brazil', 'Germany', 'France', 'Spain'], correct: 2 },
  { category: 'Sports', question: 'What sport is played at Wimbledon?', options: ['Cricket', 'Tennis', 'Golf', 'Rugby'], correct: 1 },
  { category: 'Sports', question: 'How long is a marathon in km?', options: ['38.195', '40.195', '42.195', '44.195'], correct: 2 },
];
