const pool = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding database...');

    await client.query('DELETE FROM activity_logs');
    await client.query('DELETE FROM student_topic_mastery');
    await client.query('DELETE FROM question_responses');
    await client.query('DELETE FROM attempts');
    await client.query('DELETE FROM tests');
    await client.query('DELETE FROM questions');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM batches');

    // Reset sequences
    await client.query('ALTER SEQUENCE batches_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE questions_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE tests_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE attempts_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE question_responses_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE activity_logs_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE student_topic_mastery_id_seq RESTART WITH 1');

    const batchResult = await client.query(
      'INSERT INTO batches (name, exam_type, start_date) VALUES ($1, $2, $3) RETURNING id',
      ['IBPS PO 2026', 'IBPS PO', '2026-08-01']
    );
    const batchId = batchResult.rows[0].id;
    console.log('Created batch:', batchId);

    const adminHash = await bcrypt.hash('admin123', 10);
    const adminResult = await client.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Admin Coach', 'admin@ibps.com', adminHash, 'admin']
    );
    const adminId = adminResult.rows[0].id;
    console.log('Created admin (admin@ibps.com / admin123)');

    const studentHash = await bcrypt.hash('student123', 10);
    await client.query(
      'INSERT INTO users (name, email, password_hash, role, batch_id) VALUES ($1, $2, $3, $4, $5)',
      ['Test Student', 'student@ibps.com', studentHash, 'student', batchId]
    );
    console.log('Created student (student@ibps.com / student123)');

    const questions = [
      { subject: 'Reasoning', topic: 'Seating Arrangement', subtopic: 'Linear Arrangement', difficulty: 'medium', text: 'Five persons - A, B, C, D, E - are sitting in a row facing north. B sits to the immediate right of A. C sits second to the left of B. D sits at one of the ends. Who sits exactly in the middle?', oa: 'A', ob: 'B', oc: 'C', od: 'D', correct: 'b', expl: 'The arrangement is: D - C - A - B - E (or similar). B is in the middle.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Seating Arrangement', subtopic: 'Circular Arrangement', difficulty: 'hard', text: 'Six friends sit around a circular table facing the center. P sits second to the left of Q. R sits opposite P. S sits between Q and T. U sits to the immediate right of R. Who sits opposite S?', oa: 'P', ob: 'Q', oc: 'T', od: 'U', correct: 'd', expl: 'Following the arrangement, U sits opposite S.', stage: 'mains' },
      { subject: 'Reasoning', topic: 'Puzzle', subtopic: 'Floor Based', difficulty: 'hard', text: 'Five persons live in a 5-storey building (1=ground, 5=top). A lives on an even-numbered floor. B lives two floors above C. D lives below A but above E. C lives on floor 2. On which floor does D live?', oa: 'Floor 1', ob: 'Floor 3', oc: 'Floor 4', od: 'Floor 5', correct: 'b', expl: 'C=2, B=4, A must be even so A=4 or 6 (only 4 exists). Since B is on 4 and A must be higher, A=5. D is below A and above E, so D=3.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Puzzle', subtopic: 'Scheduling', difficulty: 'medium', text: 'Four people visit a museum on different days from Monday to Thursday. P visits on Tuesday. Q visits after R but before S. Who visits on Thursday?', oa: 'P', ob: 'Q', oc: 'R', od: 'S', correct: 'd', expl: 'R -> Q -> S in that order. Monday=R, Tuesday=P, Wednesday=Q, Thursday=S.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Syllogism', subtopic: 'Two Statements', difficulty: 'easy', text: 'Statements: All apples are fruits. Some fruits are sweet. Conclusions: I. Some apples are sweet. II. All fruits are apples. Which follows?', oa: 'Only I follows', ob: 'Only II follows', oc: 'Both follow', od: 'Neither follows', correct: 'd', expl: 'The middle term "fruits" is not distributed. Neither conclusion can be definitely concluded.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Syllogism', subtopic: 'Three Statements', difficulty: 'medium', text: 'Statements: No cat is dog. All dogs are animals. Some animals are pets. Conclusions: I. Some pets are not cats. II. No cat is animal.', oa: 'Only I follows', ob: 'Only II follows', oc: 'Both follow', od: 'Neither follows', correct: 'a', expl: 'Since some animals are pets, and no cat is dog (but some animals could be cats), conclusion II is false.', stage: 'mains' },
      { subject: 'Reasoning', topic: 'Inequality', subtopic: 'Coded Inequality', difficulty: 'easy', text: 'Statement: A > B \u2265 C < D \u2264 E. Which is definitely true?', oa: 'A > C', ob: 'B < D', oc: 'C > E', od: 'A < E', correct: 'a', expl: 'A > B and B \u2265 C, so A > C is definitely true.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Data Sufficiency', subtopic: 'Two Statements', difficulty: 'medium', text: 'What is the age of Rohan? Statement I: Rohan is 5 years older than his sister. Statement II: His sister is 12 years old.', oa: 'Statement I alone is sufficient', ob: 'Statement II alone is sufficient', oc: 'Both statements together are needed', od: 'Neither statement is sufficient', correct: 'c', expl: "From I we get the relation, from II we get the sister's age.", stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Blood Relation', subtopic: 'Family Tree', difficulty: 'medium', text: 'A is the father of B. B is the sister of C. C is the mother of D. D is the brother of E. How is A related to E?', oa: 'Grandfather', ob: 'Father', oc: 'Uncle', od: 'Brother', correct: 'a', expl: "A \u2192 B/C (father). C \u2192 D/E (mother). So A is E's grandfather.", stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Direction Sense', subtopic: 'Distance', difficulty: 'easy', text: 'Rohit walks 5 km north, turns right and walks 3 km, turns right again and walks 5 km. How far is he from the starting point?', oa: '2 km', ob: '3 km', oc: '5 km', od: '8 km', correct: 'b', expl: 'After walking 5km N, 3km E, 5km S, he is 3km East of the starting point.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Order & Ranking', subtopic: 'Ranking', difficulty: 'easy', text: 'In a class of 40 students, Ravi ranks 8th from the top. What is his rank from the bottom?', oa: '32nd', ob: '33rd', oc: '34th', od: '35th', correct: 'b', expl: 'Rank from bottom = Total + 1 - Rank from top = 40 + 1 - 8 = 33.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Alphanumeric Series', subtopic: 'Letter Series', difficulty: 'easy', text: 'What comes next in the series: A, C, F, J, ?', oa: 'M', ob: 'N', oc: 'O', od: 'P', correct: 'c', expl: 'The differences increase by 1: A(+2)=C, C(+3)=F, F(+4)=J, J(+5)=O.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Coding-Decoding', subtopic: 'Letter Coding', difficulty: 'medium', text: 'If CAT is coded as 3120 and DOG is coded as 4157, how is BALL coded?', oa: '211212', ob: '21212', oc: '11212', od: '21112', correct: 'a', expl: 'Each letter is replaced by its position number (A=1..Z=26). B=2, A=1, L=12, L=12 so BALL=211212.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Input-Output', subtopic: 'Number Arrangement', difficulty: 'hard', text: 'Input: 45 23 78 12 56 34. Step 1: arrange ascending. Step 2: reverse the order. What is the final arrangement?', oa: '78 56 45 34 23 12', ob: '12 23 34 45 56 78', oc: '45 23 78 12 56 34', od: '34 56 12 78 23 45', correct: 'a', expl: 'Ascending: 12 23 34 45 56 78. Reverse: 78 56 45 34 23 12.', stage: 'mains' },
      { subject: 'Reasoning', topic: 'Logical Reasoning', subtopic: 'Cause & Effect', difficulty: 'medium', text: "Event A: The company's profits increased by 30%. Event B: The company launched a new product that became very popular. Which is true?", oa: 'A is the cause, B is the effect', ob: 'B is the cause, A is the effect', oc: 'Both are effects of a common cause', od: 'Both are independent events', correct: 'b', expl: 'The product launch (B) likely caused the profit increase (A).', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Classification', subtopic: 'Odd One Out', difficulty: 'easy', text: 'Find the odd one out: Apple, Mango, Potato, Orange', oa: 'Apple', ob: 'Mango', oc: 'Potato', od: 'Orange', correct: 'c', expl: 'Apple, Mango, Orange are fruits. Potato is a vegetable.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Analogy', subtopic: 'Word Analogy', difficulty: 'easy', text: 'Doctor : Hospital :: Teacher : ?', oa: 'School', ob: 'Hospital', oc: 'Office', od: 'Library', correct: 'a', expl: 'A doctor works in a hospital. A teacher works in a school.', stage: 'prelims' },
      { subject: 'Reasoning', topic: 'Data Interpretation', subtopic: 'Table DI', difficulty: 'hard', text: 'A table shows marks of 5 students in 3 subjects: A(80,75,90), B(85,70,85), C(75,80,80), D(90,85,95), E(70,90,75). Who has the highest total marks?', oa: 'A', ob: 'B', oc: 'C', od: 'D', correct: 'd', expl: 'D has 90+85+95=270, the highest total.', stage: 'mains' },
      { subject: 'Reasoning', topic: 'Machine Input', subtopic: 'Step Based', difficulty: 'hard', text: 'Input: word 23 tree 45 sky 12. Step 1: 12 word 23 tree 45 sky. Step 2: 12 23 word tree 45 sky. Step 3: 12 23 45 word tree sky. How many steps to sort completely?', oa: '3', ob: '4', oc: '5', od: '6', correct: 'a', expl: 'Numbers arranged in ascending order in 3 steps.', stage: 'mains' },
      { subject: 'Reasoning', topic: 'Number Series', subtopic: 'Missing Number', difficulty: 'medium', text: 'Find the missing number: 3, 7, 15, 31, ?', oa: '47', ob: '55', oc: '63', od: '71', correct: 'c', expl: 'Pattern: \u00d72 + 1. 3\u00d72+1=7, 7\u00d72+1=15, 15\u00d72+1=31, 31\u00d72+1=63.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Percentage', subtopic: 'Basic Percentage', difficulty: 'easy', text: 'What is 25% of 240?', oa: '40', ob: '50', oc: '60', od: '80', correct: 'c', expl: '25% = 1/4. 240/4 = 60.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Percentage', subtopic: 'Profit & Loss', difficulty: 'medium', text: 'A shopkeeper buys an item for Rs. 500 and sells it for Rs. 600. What is the profit percentage?', oa: '10%', ob: '15%', oc: '20%', od: '25%', correct: 'c', expl: 'Profit = 600-500 = 100. Profit% = (100/500) \u00d7 100 = 20%.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Ratio & Proportion', subtopic: 'Simple Ratio', difficulty: 'easy', text: 'If A:B = 2:3 and B:C = 4:5, what is A:C?', oa: '8:12', ob: '8:15', oc: '6:15', od: '2:5', correct: 'b', expl: 'A:B = 2:3 = 8:12, B:C = 4:5 = 12:15. So A:C = 8:15.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Speed & Distance', subtopic: 'Average Speed', difficulty: 'medium', text: 'A car travels 60 km at 40 km/h and another 60 km at 60 km/h. What is the average speed?', oa: '45 km/h', ob: '48 km/h', oc: '50 km/h', od: '52 km/h', correct: 'b', expl: 'Time1 = 60/40 = 1.5h, Time2 = 60/60 = 1h. Total = 120km/2.5h = 48 km/h.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Simple Interest', subtopic: 'Basic SI', difficulty: 'easy', text: 'Find the simple interest on Rs. 2000 for 3 years at 5% per annum.', oa: 'Rs. 200', ob: 'Rs. 250', oc: 'Rs. 300', od: 'Rs. 350', correct: 'c', expl: 'SI = (2000 \u00d7 5 \u00d7 3)/100 = Rs. 300.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Compound Interest', subtopic: 'CI Basic', difficulty: 'medium', text: 'Find the compound interest on Rs. 1000 for 2 years at 10% per annum compounded annually.', oa: 'Rs. 200', ob: 'Rs. 205', oc: 'Rs. 210', od: 'Rs. 215', correct: 'c', expl: 'A = 1000(1.1)\u00b2 = 1210. CI = 1210 - 1000 = 210.', stage: 'mains' },
      { subject: 'Quantitative Aptitude', topic: 'Time & Work', subtopic: 'Work Efficiency', difficulty: 'medium', text: 'A can do a work in 10 days, B in 15 days. How many days to complete the work together?', oa: '5 days', ob: '6 days', oc: '7 days', od: '8 days', correct: 'b', expl: "A's 1 day work = 1/10, B's = 1/15. Together = 1/10 + 1/15 = 5/30 = 1/6. So 6 days.", stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Time & Work', subtopic: 'Pipe & Cistern', difficulty: 'hard', text: 'Pipe A fills a tank in 6 hours. Pipe B fills in 8 hours. Pipe C empties in 12 hours. If all three are opened together, how long to fill the tank?', oa: '3.5 hours', ob: '4 hours', oc: '4.8 hours', od: '5.2 hours', correct: 'c', expl: 'Combined rate = 1/6 + 1/8 - 1/12 = 5/24. Time = 24/5 = 4.8 hours.', stage: 'mains' },
      { subject: 'Quantitative Aptitude', topic: 'Average', subtopic: 'Weighted Average', difficulty: 'easy', text: 'The average of 5 numbers is 20. If one number is removed, the average becomes 18. What is the removed number?', oa: '24', ob: '26', oc: '28', od: '30', correct: 'c', expl: 'Sum of 5 = 100. Sum of 4 = 72. Removed = 100 - 72 = 28.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Number System', subtopic: 'LCM & HCF', difficulty: 'easy', text: 'Find the HCF of 36 and 48.', oa: '6', ob: '8', oc: '12', od: '18', correct: 'c', expl: '36 = 2\u00b2 \u00d7 3\u00b2, 48 = 2\u2074 \u00d7 3. HCF = 2\u00b2 \u00d7 3 = 12.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Mensuration', subtopic: 'Area', difficulty: 'medium', text: 'The area of a circle is 154 sq cm. Find its radius (\u03c0 = 22/7).', oa: '5 cm', ob: '6 cm', oc: '7 cm', od: '8 cm', correct: 'c', expl: '\u03c0r\u00b2 = 154. r\u00b2 = 154 \u00d7 7/22 = 49. r = 7 cm.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Algebra', subtopic: 'Linear Equations', difficulty: 'medium', text: 'If 2x + 3y = 13 and x - y = 4, find the value of x + y.', oa: '5', ob: '6', oc: '7', od: '8', correct: 'a', expl: 'From eq 2: x = y + 4. Substitute: 2(y+4) + 3y = 13 \u2192 y = 1, x = 5. So x+y = 6.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Permutation & Combination', subtopic: 'Basic P&C', difficulty: 'hard', text: 'How many ways can 3 books be arranged on a shelf from 7 different books?', oa: '35', ob: '120', oc: '210', od: '343', correct: 'c', expl: 'P(7,3) = 7 \u00d7 6 \u00d7 5 = 210.', stage: 'mains' },
      { subject: 'Quantitative Aptitude', topic: 'Probability', subtopic: 'Basic Probability', difficulty: 'hard', text: 'A bag contains 4 red balls, 3 blue balls, and 5 green balls. What is the probability of drawing a blue ball?', oa: '1/4', ob: '1/3', oc: '3/12', od: '3/10', correct: 'a', expl: 'Total = 12. Blue = 3. P = 3/12 = 1/4.', stage: 'mains' },
      { subject: 'Quantitative Aptitude', topic: 'Data Interpretation', subtopic: 'Bar Graph', difficulty: 'medium', text: 'A bar graph shows sales (in thousands): Jan=50, Feb=60, Mar=45, Apr=70, May=55. What is the average monthly sale?', oa: '52', ob: '54', oc: '56', od: '58', correct: 'c', expl: 'Average = (50+60+45+70+55)/5 = 280/5 = 56.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Mixture & Alligation', subtopic: 'Simple Mixture', difficulty: 'medium', text: 'How many kg of rice at Rs. 50/kg should be mixed with 10 kg of rice at Rs. 30/kg to get a mixture worth Rs. 40/kg?', oa: '5 kg', ob: '8 kg', oc: '10 kg', od: '12 kg', correct: 'c', expl: 'Alligation: (50-40):(40-30) = 1:1. So 10 kg.', stage: 'mains' },
      { subject: 'Quantitative Aptitude', topic: 'Profit & Loss', subtopic: 'Discount', difficulty: 'medium', text: 'A shopkeeper offers 20% discount on an item marked at Rs. 500 and still makes 20% profit. What is the cost price?', oa: 'Rs. 300', ob: 'Rs. 320', oc: 'Rs. 333.33', od: 'Rs. 350', correct: 'c', expl: 'SP = 500 \u00d7 0.8 = 400. CP = 400/1.2 = 333.33.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Simplification', subtopic: 'BODMAS', difficulty: 'easy', text: 'Simplify: 12 + 6 \u00d7 2 - 8 \u00f7 4', oa: '18', ob: '20', oc: '22', od: '24', correct: 'c', expl: 'Using BODMAS: 12 + 12 - 2 = 22.', stage: 'prelims' },
      { subject: 'Quantitative Aptitude', topic: 'Quadratic Equations', subtopic: 'Roots', difficulty: 'hard', text: 'If x\u00b2 - 5x + 6 = 0, what is the sum of the roots?', oa: '5', ob: '-5', oc: '6', od: '-6', correct: 'a', expl: 'Sum of roots = -b/a = 5.', stage: 'mains' },
      { subject: 'Quantitative Aptitude', topic: 'Boats & Streams', subtopic: 'Speed', difficulty: 'medium', text: 'A boat travels 30 km upstream in 5 hours and 30 km downstream in 3 hours. Find the speed of the stream.', oa: '1 km/h', ob: '2 km/h', oc: '3 km/h', od: '4 km/h', correct: 'b', expl: 'Upstream = 6 km/h, Downstream = 10 km/h. Stream = (10-6)/2 = 2 km/h.', stage: 'mains' },
      { subject: 'English', topic: 'Reading Comprehension', subtopic: 'Cloze Test', difficulty: 'medium', text: 'Fill in the blank: The government has _____ new measures to control inflation.', oa: 'announced', ob: 'announcing', oc: 'announce', od: 'announces', correct: 'a', expl: 'Present perfect requires past participle.', stage: 'prelims' },
      { subject: 'English', topic: 'Grammar', subtopic: 'Subject-Verb Agreement', difficulty: 'easy', text: 'Neither the teacher nor the students _____ present.', oa: 'was', ob: 'were', oc: 'is', od: 'has been', correct: 'b', expl: 'With "neither...nor", verb agrees with the nearest subject (students).', stage: 'prelims' },
      { subject: 'English', topic: 'Vocabulary', subtopic: 'Synonyms', difficulty: 'easy', text: 'Choose the synonym of "Benevolent":', oa: 'Cruel', ob: 'Kind', oc: 'Angry', od: 'Selfish', correct: 'b', expl: 'Benevolent means well-meaning, kindly.', stage: 'prelims' },
      { subject: 'English', topic: 'Vocabulary', subtopic: 'Antonyms', difficulty: 'easy', text: 'Choose the antonym of "Abundant":', oa: 'Plentiful', ob: 'Scarce', oc: 'Ample', od: 'Sufficient', correct: 'b', expl: 'Abundant means plentiful; scarce is opposite.', stage: 'prelims' },
      { subject: 'English', topic: 'Reading Comprehension', subtopic: 'Passage Based', difficulty: 'hard', text: 'Read: "The industrial revolution brought significant changes to society. It transformed how goods were produced and how people lived and worked." What was the primary impact?', oa: 'Political changes', ob: 'Social & economic transformation', oc: 'Cultural revival', od: 'Environmental damage', correct: 'b', expl: 'The passage mentions transformation of production, living, and working.', stage: 'mains' },
      { subject: 'English', topic: 'Grammar', subtopic: 'Tenses', difficulty: 'medium', text: 'She _____ (work) here since 2015.', oa: 'worked', ob: 'has been working', oc: 'was working', od: 'had worked', correct: 'b', expl: '"Since 2015" indicates action continuing from past to present.', stage: 'prelims' },
      { subject: 'English', topic: 'Sentence Correction', subtopic: 'Error Spotting', difficulty: 'medium', text: 'Find the error: "The team (A) are playing (B) well (C) today (D) No error."', oa: 'A', ob: 'B', oc: 'C', od: 'No error', correct: 'd', expl: 'Collective nouns can take plural verbs in British English.', stage: 'mains' },
      { subject: 'English', topic: 'Para Jumbles', subtopic: 'Sentence Ordering', difficulty: 'hard', text: 'Arrange: 1. It is a major economic activity. 2. India is an agricultural country. 3. Most people depend on farming. 4. The monsoon is crucial for crops.', oa: '2-1-3-4', ob: '2-3-1-4', oc: '3-2-1-4', od: '1-2-3-4', correct: 'b', expl: 'Main idea (2), support (3), conclusion (1), detail (4).', stage: 'mains' },
      { subject: 'English', topic: 'Vocabulary', subtopic: 'Idioms', difficulty: 'medium', text: 'What does "Hit the nail on the head" mean?', oa: 'To cause damage', ob: 'To work hard', oc: 'To describe exactly what is causing a situation', od: 'To fail', correct: 'c', expl: 'It means to describe exactly what is causing a situation.', stage: 'prelims' },
      { subject: 'English', topic: 'Grammar', subtopic: 'Prepositions', difficulty: 'easy', text: 'He is proficient _____ English.', oa: 'in', ob: 'at', oc: 'on', od: 'with', correct: 'a', expl: 'The correct preposition is "proficient in".', stage: 'prelims' },
      { subject: 'General Awareness', topic: 'Banking', subtopic: 'RBI', difficulty: 'medium', text: 'Who is the governor of RBI (as of 2026)?', oa: 'Shaktikanta Das', ob: 'Urjit Patel', oc: 'Raghuram Rajan', od: 'D Subbarao', correct: 'a', expl: 'Shaktikanta Das has been RBI governor since December 2018.', stage: 'prelims' },
      { subject: 'General Awareness', topic: 'Economy', subtopic: 'Budget', difficulty: 'medium', text: 'What is the Fiscal Deficit?', oa: 'Total expenditure - Total revenue', ob: 'Total revenue - Total expenditure', oc: 'Total borrowing - Total spending', od: 'GDP - Total revenue', correct: 'a', expl: 'Fiscal deficit is the difference between total expenditure and total revenue.', stage: 'mains' },
      { subject: 'General Awareness', topic: 'Current Affairs', subtopic: 'National', difficulty: 'easy', text: 'What is the capital of India?', oa: 'Mumbai', ob: 'New Delhi', oc: 'Kolkata', od: 'Chennai', correct: 'b', expl: 'New Delhi is the capital of India.', stage: 'prelims' },
      { subject: 'General Awareness', topic: 'Static GK', subtopic: 'Geography', difficulty: 'easy', text: 'Which is the largest state in India by area?', oa: 'Uttar Pradesh', ob: 'Maharashtra', oc: 'Rajasthan', od: 'Madhya Pradesh', correct: 'c', expl: 'Rajasthan is the largest by area (342,239 sq km).', stage: 'prelims' },
      { subject: 'General Awareness', topic: 'Banking', subtopic: 'Schemes', difficulty: 'medium', text: 'Which scheme provides financial inclusion to all citizens?', oa: 'Jan Dhan Yojana', ob: 'Skill India', oc: 'Digital India', od: 'Startup India', correct: 'a', expl: "PM Jan Dhan Yojana is India's national mission for financial inclusion.", stage: 'mains' },
      { subject: 'Computer Knowledge', topic: 'Basics', subtopic: 'Hardware', difficulty: 'easy', text: 'What does CPU stand for?', oa: 'Central Processing Unit', ob: 'Computer Personal Unit', oc: 'Central Program Unit', od: 'Core Processing Unit', correct: 'a', expl: 'CPU = Central Processing Unit, the brain of the computer.', stage: 'prelims' },
      { subject: 'Computer Knowledge', topic: 'Networking', subtopic: 'Protocols', difficulty: 'medium', text: 'Which protocol is used for sending email?', oa: 'HTTP', ob: 'FTP', oc: 'SMTP', od: 'TCP', correct: 'c', expl: 'SMTP (Simple Mail Transfer Protocol) is used for sending emails.', stage: 'mains' },
      { subject: 'Computer Knowledge', topic: 'MS Office', subtopic: 'Excel', difficulty: 'easy', text: 'In Excel, what function adds a range of cells?', oa: 'SUM', ob: 'ADD', oc: 'TOTAL', od: 'PLUS', correct: 'a', expl: 'The SUM function adds a range of cells.', stage: 'prelims' },
      { subject: 'Computer Knowledge', topic: 'Internet', subtopic: 'Security', difficulty: 'medium', text: 'What is phishing?', oa: 'A computer virus', ob: 'A fraudulent attempt to obtain sensitive information', oc: 'A programming language', od: 'A network protocol', correct: 'b', expl: 'Phishing is a cyber attack using disguised email to trick recipients.', stage: 'mains' },
      { subject: 'Computer Knowledge', topic: 'Basics', subtopic: 'Memory', difficulty: 'easy', text: 'Which memory is non-volatile?', oa: 'RAM', ob: 'ROM', oc: 'Cache', od: 'Register', correct: 'b', expl: 'ROM retains data when power is off - non-volatile.', stage: 'prelims' },
    ];

    const questionIds = [];
    for (const q of questions) {
      const result = await client.query(
        'INSERT INTO questions (subject, topic, subtopic, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, exam_stage, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
        [q.subject, q.topic, q.subtopic, q.difficulty, q.text, q.oa, q.ob, q.oc, q.od, q.correct, q.expl, q.stage, adminId]
      );
      questionIds.push(result.rows[0].id);
    }
    console.log('Inserted ' + questions.length + ' questions');

    const reaIds = questionIds.slice(0, 20);
    const quantIds = questionIds.slice(20, 40);
    const engIds = questionIds.slice(40, 50);
    const allIds = questionIds;

    await client.query(
      'INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, batch_id, question_ids) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['IBPS PO Full Mock 1', 'full_mock', 'prelims', 60, 0.25, batchId, JSON.stringify(allIds)]
    );
    console.log('Created: Full Mock Test (60 questions)');

    await client.query(
      'INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, batch_id, question_ids) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['Reasoning Ability Sectional', 'sectional', 'prelims', 20, 0.25, batchId, JSON.stringify(reaIds)]
    );
    console.log('Created: Reasoning Sectional Test');

    await client.query(
      'INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, batch_id, question_ids) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['Quantitative Aptitude Sectional', 'sectional', 'prelims', 20, 0.25, batchId, JSON.stringify(quantIds)]
    );
    console.log('Created: Quantitative Aptitude Sectional Test');

    await client.query(
      'INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, batch_id, question_ids) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['English Language Sectional', 'sectional', 'prelims', 15, 0.25, batchId, JSON.stringify(engIds)]
    );
    console.log('Created: English Sectional Test');

    const easyReaQ = questionIds.filter((_, i) => i < 20 && (questions[i].difficulty === 'easy' || questions[i].difficulty === 'medium')).slice(0, 10);
    await client.query(
      'INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, batch_id, question_ids) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['Reasoning Basics Practice', 'topic_practice', 'prelims', 15, 0, batchId, JSON.stringify(easyReaQ)]
    );
    console.log('Created: Topic Practice Test');

    await client.query('COMMIT');
    console.log('\nSeed completed successfully!');
    console.log('\nLogin credentials:');
    console.log('  Admin:   admin@ibps.com / admin123');
    console.log('  Student: student@ibps.com / student123');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed().then(() => pool.end());
