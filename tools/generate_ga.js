#!/usr/bin/env node
/**
 * Deterministic General Awareness (Static GK) question generator.
 * Every answer is a curated fact — correctness guaranteed by construction.
 * Emits ga_upload.csv / .xlsx / summary.json for the admin uploader.
 *
 * Usage: node tools/generate_ga.js [--count 600] [--seed 20260804]
 */
const { mulberry32, rand, pick, shuffle, buildQ, verify, emit, argValue, normText, loadExistingTexts } = require('./_genlib');

const MAINS = 'mains';

// country, capital, currency
const COUNTRIES = [
  ['Afghanistan', 'Kabul', 'Afghani'], ['Argentina', 'Buenos Aires', 'Peso'],
  ['Australia', 'Canberra', 'Australian Dollar'], ['Austria', 'Vienna', 'Euro'],
  ['Bangladesh', 'Dhaka', 'Taka'], ['Belgium', 'Brussels', 'Euro'],
  ['Brazil', 'Brasilia', 'Real'], ['Canada', 'Ottawa', 'Canadian Dollar'],
  ['Chile', 'Santiago', 'Peso'], ['China', 'Beijing', 'Yuan'],
  ['Cuba', 'Havana', 'Cuban Peso'], ['Denmark', 'Copenhagen', 'Danish Krone'],
  ['Egypt', 'Cairo', 'Egyptian Pound'], ['Finland', 'Helsinki', 'Euro'],
  ['France', 'Paris', 'Euro'], ['Germany', 'Berlin', 'Euro'],
  ['Greece', 'Athens', 'Euro'], ['India', 'New Delhi', 'Rupee'],
  ['Indonesia', 'Jakarta', 'Rupiah'], ['Iran', 'Tehran', 'Rial'],
  ['Iraq', 'Baghdad', 'Dinar'], ['Ireland', 'Dublin', 'Euro'],
  ['Israel', 'Jerusalem', 'Shekel'], ['Italy', 'Rome', 'Euro'],
  ['Japan', 'Tokyo', 'Yen'], ['Kenya', 'Nairobi', 'Kenyan Shilling'],
  ['Malaysia', 'Kuala Lumpur', 'Ringgit'], ['Mexico', 'Mexico City', 'Peso'],
  ['Myanmar', 'Naypyidaw', 'Kyat'], ['Nepal', 'Kathmandu', 'Nepalese Rupee'],
  ['Netherlands', 'Amsterdam', 'Euro'], ['New Zealand', 'Wellington', 'New Zealand Dollar'],
  ['Nigeria', 'Abuja', 'Naira'], ['Norway', 'Oslo', 'Norwegian Krone'],
  ['Pakistan', 'Islamabad', 'Pakistani Rupee'], ['Philippines', 'Manila', 'Philippine Peso'],
  ['Poland', 'Warsaw', 'Zloty'], ['Portugal', 'Lisbon', 'Euro'],
  ['Russia', 'Moscow', 'Russian Ruble'], ['Saudi Arabia', 'Riyadh', 'Saudi Riyal'],
  ['Singapore', 'Singapore', 'Singapore Dollar'], ['South Africa', 'Pretoria', 'South African Rand'],
  ['South Korea', 'Seoul', 'South Korean Won'], ['Spain', 'Madrid', 'Euro'],
  ['Sri Lanka', 'Colombo', 'Sri Lankan Rupee'], ['Sweden', 'Stockholm', 'Swedish Krona'],
  ['Switzerland', 'Bern', 'Swiss Franc'], ['Thailand', 'Bangkok', 'Baht'],
  ['Turkey', 'Ankara', 'Turkish Lira'], ['United Arab Emirates', 'Abu Dhabi', 'Dirham'],
  ['United Kingdom', 'London', 'British Pound'], ['United States', 'Washington D.C.', 'US Dollar'],
  ['Vietnam', 'Hanoi', 'Dong'], ['Bhutan', 'Thimphu', 'Ngultrum'],
  ['Maldives', 'Male', 'Rufiyaa'], ['Albania', 'Tirana', 'Lek'],
  ['Algeria', 'Algiers', 'Algerian Dinar'], ['Angola', 'Luanda', 'Kwanza'],
  ['Belarus', 'Minsk', 'Belarusian Ruble'], ['Cambodia', 'Phnom Penh', 'Riel'],
  ['Colombia', 'Bogota', 'Colombian Peso'], ['Czech Republic', 'Prague', 'Czech Koruna'],
  ['Ethiopia', 'Addis Ababa', 'Ethiopian Birr'], ['Ghana', 'Accra', 'Cedi'],
  ['Hungary', 'Budapest', 'Forint'], ['Iceland', 'Reykjavik', 'Icelandic Krona'],
  ['Jordan', 'Amman', 'Jordanian Dinar'], ['Kazakhstan', 'Astana', 'Tenge'],
  ['Kuwait', 'Kuwait City', 'Kuwaiti Dinar'], ['Lebanon', 'Beirut', 'Lebanese Pound'],
  ['Malta', 'Valletta', 'Euro'], ['Mongolia', 'Ulaanbaatar', 'Tugrik'],
  ['Morocco', 'Rabat', 'Moroccan Dirham'], ['Mozambique', 'Maputo', 'Metical'],
  ['North Korea', 'Pyongyang', 'North Korean Won'], ['Oman', 'Muscat', 'Omani Rial'],
  ['Paraguay', 'Asuncion', 'Guarani'], ['Peru', 'Lima', 'Sol'],
  ['Qatar', 'Doha', 'Qatari Riyal'], ['Romania', 'Bucharest', 'Romanian Leu'],
  ['Senegal', 'Dakar', 'CFA Franc'], ['Serbia', 'Belgrade', 'Serbian Dinar'],
  ['Slovakia', 'Bratislava', 'Euro'], ['Slovenia', 'Ljubljana', 'Euro'],
  ['Sudan', 'Khartoum', 'Sudanese Pound'], ['Syria', 'Damascus', 'Syrian Pound'],
  ['Tanzania', 'Dodoma', 'Tanzanian Shilling'], ['Tunisia', 'Tunis', 'Tunisian Dinar'],
  ['Ukraine', 'Kyiv', 'Hryvnia'], ['Uruguay', 'Montevideo', 'Uruguayan Peso'],
  ['Uzbekistan', 'Tashkent', 'Uzbek Som'], ['Venezuela', 'Caracas', 'Bolivar'],
  ['Zambia', 'Lusaka', 'Kwacha'], ['Zimbabwe', 'Harare', 'Zimbabwean Dollar'],
];

// state, capital
const STATES = [
  ['Andhra Pradesh', 'Amaravati'], ['Arunachal Pradesh', 'Itanagar'], ['Assam', 'Dispur'],
  ['Bihar', 'Patna'], ['Chhattisgarh', 'Raipur'], ['Goa', 'Panaji'],
  ['Gujarat', 'Gandhinagar'], ['Haryana', 'Chandigarh'], ['Himachal Pradesh', 'Shimla'],
  ['Jharkhand', 'Ranchi'], ['Karnataka', 'Bengaluru'], ['Kerala', 'Thiruvananthapuram'],
  ['Madhya Pradesh', 'Bhopal'], ['Maharashtra', 'Mumbai'], ['Manipur', 'Imphal'],
  ['Meghalaya', 'Shillong'], ['Mizoram', 'Aizawl'], ['Nagaland', 'Kohima'],
  ['Odisha', 'Bhubaneswar'], ['Punjab', 'Chandigarh'], ['Rajasthan', 'Jaipur'],
  ['Sikkim', 'Gangtok'], ['Tamil Nadu', 'Chennai'], ['Telangana', 'Hyderabad'],
  ['Tripura', 'Agartala'], ['Uttar Pradesh', 'Lucknow'], ['Uttarakhand', 'Dehradun'],
  ['West Bengal', 'Kolkata'],
];

const DAYS = [
  ['1 January', 'World Peace Day / Global Family Day'], ['15 January', 'Army Day'],
  ['26 January', 'Republic Day of India'], ['28 February', 'National Science Day'],
  ['8 March', 'International Women\'s Day'], ['22 March', 'World Water Day'],
  ['7 April', 'World Health Day'], ['22 April', 'Earth Day'],
  ['1 May', 'International Labour Day'], ['5 June', 'World Environment Day'],
  ['14 June', 'World Blood Donor Day'], ['26 June', 'International Day Against Drug Abuse'],
  ['11 July', 'World Population Day'], ['15 August', 'Independence Day of India'],
  ['29 August', 'National Sports Day'], ['5 September', 'Teachers\' Day'],
  ['15 September', 'International Day of Democracy'], ['2 October', 'Gandhi Jayanti'],
  ['24 October', 'United Nations Day'], ['31 October', 'National Unity Day'],
  ['14 November', 'Children\'s Day'], ['26 November', 'Constitution Day of India'],
  ['1 December', 'World AIDS Day'], ['10 December', 'Human Rights Day'],
  ['12 January', 'National Youth Day'], ['30 January', 'Martyrs\' Day'],
  ['21 February', 'International Mother Language Day'],
  ['24 March', 'World TB Day'], ['21 April', 'Civil Services Day'],
  ['29 April', 'World Dance Day'], ['3 May', 'World Press Freedom Day'],
  ['12 May', 'International Nurses Day'], ['17 May', 'World Telecommunication Day'],
  ['31 May', 'World No-Tobacco Day'],
  ['8 June', 'World Oceans Day'], ['17 June', 'World Day to Combat Desertification'],
  ['21 June', 'International Yoga Day'],
  ['18 July', 'Nelson Mandela International Day'], ['9 August', 'International Day of the World\'s Indigenous Peoples'],
  ['19 August', 'World Humanitarian Day'], ['21 September', 'International Day of Peace'],
  ['5 October', 'World Teachers\' Day'], ['16 October', 'World Food Day'],
  ['13 November', 'World Kindness Day'], ['3 December', 'International Day of Persons with Disabilities'],
  ['2 February', 'World Wetlands Day'], ['4 February', 'World Cancer Day'],
  ['20 February', 'World Day of Social Justice'], ['27 February', 'World NGO Day'],
  ['3 March', 'World Wildlife Day'], ['20 March', 'International Day of Happiness'],
  ['23 March', 'World Meteorological Day'], ['25 April', 'World Malaria Day'],
  ['26 April', 'World Intellectual Property Day'], ['28 April', 'World Day for Safety and Health at Work'],
  ['1 June', 'World Milk Day'], ['23 June', 'International Olympic Day'],
  ['28 July', 'World Hepatitis Day'], ['29 July', 'International Tiger Day'],
  ['12 August', 'International Youth Day'], ['23 August', 'National Space Day (India)'],
  ['8 September', 'International Literacy Day'], ['16 September', 'International Day for the Preservation of the Ozone Layer'],
  ['30 November', 'World Computer Literacy Day'], ['5 December', 'World Soil Day'],
  ['7 December', 'International Civil Aviation Day'], ['9 December', 'International Anti-Corruption Day'],
  ['14 December', 'National Energy Conservation Day'], ['18 December', 'International Migrants Day'],
  ['22 December', 'National Mathematics Day (India)'], ['24 December', 'National Consumer Rights Day'],
  ['27 December', 'International Day of Epidemic Preparedness'],
];

const BANKING_TERMS = [
  ['CRR', 'the share of deposits banks must keep with the RBI in cash'],
  ['SLR', 'the minimum percentage of deposits banks must maintain in liquid assets'],
  ['Repo Rate', 'the rate at which the RBI lends money to commercial banks'],
  ['Reverse Repo Rate', 'the rate at which the RBI borrows money from commercial banks'],
  ['NEFT', 'National Electronic Funds Transfer — a nationwide electronic fund transfer system'],
  ['RTGS', 'Real Time Gross Settlement — settles payments individually in real time'],
  ['IMPS', 'Immediate Payment Service — instant 24×7 interbank transfer'],
  ['UPI', 'Unified Payments Interface — instant mobile payment system'],
  ['KYC', 'Know Your Customer — the process of verifying a customer\'s identity'],
  ['FD', 'Fixed Deposit — money kept for a fixed term at a fixed interest rate'],
  ['RD', 'Recurring Deposit — monthly deposits earning interest until maturity'],
  ['Credit Card', 'a payment card that allows borrowing within a credit limit'],
  ['Debit Card', 'a payment card that deducts money directly from the savings account'],
  ['ATM', 'Automated Teller Machine — dispenses cash and provides banking services'],
  ['Basel III', 'international regulatory framework for bank capital adequacy'],
  ['NBFC', 'a non-banking financial company that provides financial services without a banking licence'],
  ['NPA', 'Non-Performing Asset — a loan on which interest or principal is overdue'],
  ['PPI', 'Prepaid Payment Instrument — like a wallet or prepaid card'],
  ['AEPS', 'Aadhaar Enabled Payment System — enables banking through Aadhaar authentication'],
  ['SWIFT', 'the international network used for cross-border financial transactions'],
  ['RuPay', 'India\'s own domestic card payment network'],
  ['Bharat BillPay', 'an integrated bill payment system for recurring and utility bills'],
  ['Cheque Truncation', 'the process of clearing cheques electronically without physical movement'],
  ['Priority Sector Lending', 'mandated lending to agriculture, small industry and weaker sections'],
  ['Capital Adequacy Ratio', 'a bank\'s capital expressed as a ratio of its risk-weighted assets'],
  ['Base Rate', 'the former minimum lending rate of banks (replaced by MCLR)'],
  ['MCLR', 'Marginal Cost of Funds based Lending Rate — the internal benchmark for bank loans'],
  ['Treasury Bills', 'short-term government securities with maturity up to one year'],
  ['Certificate of Deposit', 'a short-term money-market instrument issued by banks'],
  ['Commercial Paper', 'an unsecured short-term promissory note issued by companies'],
  ['PMAY Housing Loan', 'a subsidised housing loan under the Pradhan Mantri Awas Yojana'],
];

const BANK_FACTS = [
  ['Reserve Bank of India (RBI)', 'the central bank of India, established in 1935'],
  ['SBI', 'largest public sector bank in India (State Bank of India)'],
  ['1949', 'the year the Reserve Bank of India was nationalized'],
  ['NABARD', 'the apex development bank for agriculture and rural development (1982)'],
  ['SIDBI', 'Small Industries Development Bank of India (1990)'],
  ['EXIM Bank', 'Export-Import Bank of India (1982), promotes foreign trade'],
  ['Regional Rural Banks', 'established under the RRB Act of 1976 to serve rural areas'],
  ['Demonetization', 'withdrew ₹500 and ₹1,000 notes on 8 November 2016'],
  ['GST', 'Goods and Services Tax, implemented in India on 1 July 2017'],
  ['Monetary Policy', 'the RBI\'s tool to control money supply and interest rates'],
  ['Bank of Hindustan', 'generally considered the first bank established in India (1770)'],
  ['Bank of Bengal', 'founded in 1806, one of the three Presidency banks'],
  ['Imperial Bank of India', 'predecessor of the State Bank of India'],
  ['Cooperative Banks', 'financial institutions that serve the needs of agriculture and rural finance'],
  ['MUDRA Yojana', 'provides loans up to ₹10 lakh to small and micro enterprises'],
  ['State Bank of India', 'was formed in 1955 from the merger of the Imperial Bank of India'],
  ['14 Banks', 'were nationalized in the first wave of bank nationalisation in 1969'],
  ['6 Banks', 'were nationalized in the second wave of bank nationalisation in 1980'],
  ['DICGC', 'insures bank deposits of up to ₹5 lakh per depositor'],
  ['White Label ATMs', 'ATMs operated by non-bank entities using the RBI\'s approval'],
  ['HDFC Bank', 'was among the first new-generation private banks licensed in 1994'],
  ['PSB Reorganisation', 'the 2019 merger plan that reduced the number of public sector banks'],
  ['Scheduled Banks', 'banks listed in the Second Schedule of the RBI Act, 1934'],
  ['Local Area Banks', 'small banks operating in a limited geographical area'],
  ['Payments Banks', 'banks that accept deposits and provide payments but do not lend'],
  ['Small Finance Banks', 'banks set up to serve small businesses and the unbanked'],
];

const SCHEMES = [
  ['Pradhan Mantri Jan Dhan Yojana', 'aims at financial inclusion by opening bank accounts for all', 2014],
  ['Pradhan Mantri Awas Yojana', 'provides affordable housing for all', 2015],
  ['Swachh Bharat Abhiyan', 'a national cleanliness mission', 2014],
  ['Beti Bachao Beti Padhao', 'aims to address the declining child sex ratio and educate girls', 2015],
  ['Make in India', 'encourages manufacturing within India', 2014],
  ['Digital India', 'aims to transform India into a digitally empowered society', 2015],
  ['Startup India', 'promotes entrepreneurship and startup growth', 2016],
  ['Ayushman Bharat', 'provides health insurance cover to vulnerable families', 2018],
  ['Pradhan Mantri Kisan Samman Nidhi', 'provides income support of ₹6,000 per year to farmers', 2019],
  ['Skill India', 'trains youth in employable skills', 2015],
  ['Pradhan Mantri Mudra Yojana', 'provides loans to small and micro enterprises', 2015],
  ['Atal Pension Yojana', 'provides pension to workers in the unorganised sector', 2015],
  ['Pradhan Mantri Ujjwala Yojana', 'provides free LPG connections to poor households', 2016],
  ['Pradhan Mantri Fasal Bima Yojana', 'provides crop insurance to farmers', 2016],
  ['Jal Jeevan Mission', 'aims to provide tap water to every rural household', 2019],
  ['Pradhan Mantri Svanidhi Yojana', 'provides loans to street vendors', 2020],
  ['Mission Indradhanush', 'aims at full immunisation of children', 2014],
  ['Pradhan Mantri Garib Kalyan Anna Yojana', 'provides free foodgrains to the poor', 2020],
  ['Pradhan Mantri Vaya Vandana Yojana', 'provides pension to senior citizens', 2017],
  ['Pradhan Mantri Kaushal Vikas Yojana', 'provides skill training to youth', 2015],
  ['Rashtriya Poshan Abhiyan', 'aims to improve the nutritional status of children', 2018],
  ['Rashtriya Swasthya Bima Yojana', 'provided health insurance cover to BPL families', 2008],
  ['Sukanya Samriddhi Yojana', 'is a savings scheme for the girl child', 2015],
  ['Mahatma Gandhi NREGA', 'guarantees 100 days of wage employment to rural households', 2005],
  ['Pradhan Mantri Gati Shakti', 'aims at multimodal connectivity infrastructure', 2021],
  ['Sagarmala', 'is a port-led development programme', 2015],
  ['Bharat Net', 'connects gram panchayats with broadband internet', 2017],
  ['Deen Dayal Upadhyaya Antyodaya Yojana', 'aims at urban and rural poverty alleviation', 2015],
  ['Pradhan Mantri Vishwakarma', 'supports traditional artisans and craftspeople', 2023],
  ['Ayushman Bharat Digital Mission', 'creates a digital health ecosystem', 2021],
  ['e-NAM', 'is a national electronic agriculture market platform', 2016],
  ['Ujjwala 2.0', 'extends free LPG connections to additional households', 2021],
];

const BOOKS = [
  ['Wings of Fire', 'A.P.J. Abdul Kalam'], ['My Experiments with Truth', 'Mahatma Gandhi'],
  ['Discovery of India', 'Jawaharlal Nehru'], ['Gitanjali', 'Rabindranath Tagore'],
  ['The Guide', 'R.K. Narayan'], ['Godan', 'Munshi Premchand'],
  ['Anandmath', 'Bankim Chandra Chatterjee'], ['India of My Dreams', 'M.K. Gandhi'],
  ['The Origin of Species', 'Charles Darwin'], ['Rich Dad Poor Dad', 'Robert Kiyosaki'],
  ['Think and Grow Rich', 'Napoleon Hill'], ['The Wealth of Nations', 'Adam Smith'],
  ['Glimpses of World History', 'Jawaharlal Nehru'], ['Malgudi Days', 'R.K. Narayan'],
  ['Julius Caesar', 'William Shakespeare'], ['Ignited Minds', 'A.P.J. Abdul Kalam'],
  ['Pride and Prejudice', 'Jane Austen'], ['War and Peace', 'Leo Tolstoy'],
  ['Crime and Punishment', 'Fyodor Dostoevsky'], ['Animal Farm', 'George Orwell'],
  ['Gone with the Wind', 'Margaret Mitchell'], ['The God of Small Things', 'Arundhati Roy'],
  ['Train to Pakistan', 'Khushwant Singh'], ['A Suitable Boy', 'Vikram Seth'],
  ['The White Tiger', 'Aravind Adiga'], ['Shakuntala', 'Kalidasa'],
  ['A Passage to India', 'E.M. Forster'], ['Midnight\'s Children', 'Salman Rushdie'],
  ['The Glass Palace', 'Amitav Ghosh'], ['Five Point Someone', 'Chetan Bhagat'],
  ['The Great Gatsby', 'F. Scott Fitzgerald'], ['To Kill a Mockingbird', 'Harper Lee'],
  ['Moby Dick', 'Herman Melville'], ['The Adventures of Tom Sawyer', 'Mark Twain'],
  ['Anna Karenina', 'Leo Tolstoy'], ['The Old Man and the Sea', 'Ernest Hemingway'],
  ['1984', 'George Orwell'], ['A Tale of Two Cities', 'Charles Dickens'],
  ['Don Quixote', 'Miguel de Cervantes'], ['The Ramayana', 'Valmiki'],
  ['The Mahabharata', 'Ved Vyasa'], ['Rajatarangini', 'Kalhana'],
  ['Arthashastra', 'Kautilya'], ['The Alchemist', 'Paulo Coelho'],
  ['Harry Potter and the Philosopher\'s Stone', 'J.K. Rowling'],
];

const ECONOMY = [
  ['GDP', 'Gross Domestic Product — total value of goods and services produced in a country in a year'],
  ['Inflation', 'a sustained increase in the general price level'],
  ['Fiscal Policy', 'government policy on taxation and public spending'],
  ['Monetary Policy', 'central bank policy controlling money supply and interest rates'],
  ['Budget', 'the annual financial statement of the government'],
  ['FDII', 'Foreign Direct Investment — investment by a foreign entity in domestic assets'],
  ['FPI', 'Foreign Portfolio Investment — investment in financial assets like stocks and bonds'],
  ['Disinflation', 'a reduction in the rate of inflation'],
  ['Deflation', 'a sustained fall in the general price level'],
  ['CAGR', 'Compound Annual Growth Rate'],
  ['Balance of Trade', 'the difference between the value of exports and imports of goods'],
  ['Primary Deficit', 'fiscal deficit minus interest payments on past borrowings'],
  ['Stagflation', 'high inflation combined with economic stagnation'],
  ['Per Capita Income', 'the average income earned per person in a country in a year'],
  ['Repo Rate', 'the rate at which the central bank lends to commercial banks'],
  ['GNP', 'Gross National Product — GDP plus net income earned from abroad'],
  ['NNP', 'Net National Product — GNP minus depreciation'],
  ['NDP', 'Net Domestic Product — GDP minus depreciation'],
  ['WPI', 'Wholesale Price Index — measures changes in wholesale prices'],
  ['CPI', 'Consumer Price Index — measures changes in retail prices'],
  ['Fiscal Deficit', 'the excess of total expenditure over total receipts excluding borrowings'],
  ['Revenue Deficit', 'the excess of revenue expenditure over revenue receipts'],
  ['MSF', 'Marginal Standing Facility — an overnight borrowing window for banks'],
  ['Bank Rate', 'the long-term rate at which the RBI lends to banks'],
  ['MCLR', 'the Marginal Cost of Funds based Lending Rate for bank loans'],
  ['Monetary Policy Committee', 'a six-member committee that decides the repo rate'],
  ['Inflation Targeting', 'India\'s inflation target of 4% with a ±2% band'],
];

const FIRSTS = [
  ['Rajendra Prasad', 'first President of India'],
  ['Jawaharlal Nehru', 'first Prime Minister of India'],
  ['Dr. B.R. Ambedkar', 'Chairman of the Drafting Committee of the Indian Constitution'],
  ['C. Rajagopalachari', 'first and only Indian Governor-General of India'],
  ['Kalpana Chawla', 'first Indian-born woman in space'],
  ['Rakesh Sharma', 'first Indian in space'],
  ['Mother Teresa', 'first Indian (resident) Nobel Peace Prize winner'],
  ['Indira Gandhi', 'first woman Prime Minister of India'],
  ['Pratibha Patil', 'first woman President of India'],
  ['Bachendri Pal', 'first Indian woman to climb Mount Everest'],
  ['Dr. Zakir Husain', 'first Muslim President of India'],
  ['Kiran Bedi', 'first woman Indian Police Service (IPS) officer'],
  ['Reita Faria', 'first Indian woman to win the Miss World title'],
  ['Arati Saha', 'first Indian woman to swim across the English Channel'],
  ['Mihir Sen', 'first Indian to swim across the English Channel'],
  ['JRD Tata', 'first Indian to be granted a pilot\'s licence'],
  ['Abhinav Bindra', 'first Indian to win an individual Olympic gold medal'],
  ['Neeraj Chopra', 'first Indian to win an Olympic gold in track and field'],
  ['Sachin Tendulkar', 'first batsman in the world to score 100 international centuries'],
];

const SPORTS = [
  ['Cricket', 'Ranji Trophy'], ['Hockey', 'Dhyan Chand Trophy'], ['Football', 'Santosh Trophy'],
  ['Badminton', 'Thomas Cup'], ['Tennis', 'Davis Cup'], ['Hockey', 'Sultan Azlan Shah Cup'],
  ['Cricket', 'Border-Gavaskar Trophy'], ['Cricket', 'Duleep Trophy'], ['Cricket', 'Irani Cup'],
  ['Cricket', 'Asia Cup'], ['Football', 'FIFA World Cup'], ['Football', 'Nehru Cup'],
  ['Tennis', 'Wimbledon'], ['Tennis', 'US Open'], ['Hockey', 'Aga Khan Cup'],
  ['Badminton', 'Uber Cup'], ['Table Tennis', 'Swaythling Cup'], ['Cricket', 'World Cup'],
  ['Cricket', 'T20 World Cup'], ['Cricket', 'Deodhar Trophy'], ['Cricket', 'Vijay Hazare Trophy'],
  ['Kabaddi', 'Pro Kabaddi League'], ['Hockey', 'Champions Trophy'], ['Hockey', 'Asia Cup'],
  ['Football', 'Durand Cup'], ['Football', 'AFC Asian Cup'], ['Tennis', 'Australian Open'],
  ['Tennis', 'French Open'], ['Golf', 'Ryder Cup'], ['Basketball', 'NBA Championship'],
  ['Chess', 'World Chess Championship'],
];

const GA_ABBR = [
  ['SEBI', 'Securities and Exchange Board of India'], ['IRDAI', 'Insurance Regulatory and Development Authority of India'],
  ['IMF', 'International Monetary Fund'], ['WTO', 'World Trade Organization'], ['UNO', 'United Nations Organization'],
  ['WHO', 'World Health Organization'], ['UNICEF', 'United Nations International Children\'s Emergency Fund'],
  ['SAARC', 'South Asian Association for Regional Cooperation'], ['BRICS', 'Brazil, Russia, India, China, South Africa'],
  ['ASEAN', 'Association of Southeast Asian Nations'], ['OPEC', 'Organization of the Petroleum Exporting Countries'],
  ['FDI', 'Foreign Direct Investment'], ['RBI', 'Reserve Bank of India'], ['NPCI', 'National Payments Corporation of India'],
  ['ISRO', 'Indian Space Research Organisation'], ['DRDO', 'Defence Research and Development Organisation'],
  ['BARC', 'Bhabha Atomic Research Centre'],   ['NITI Aayog', 'National Institution for Transforming India'],
  ['NASSCOM', 'National Association of Software and Service Companies'],
  ['FEMA', 'Foreign Exchange Management Act'], ['PMLA', 'Prevention of Money Laundering Act'],
  ['IBC', 'Insolvency and Bankruptcy Code'], ['RERA', 'Real Estate (Regulation and Development) Act'],
  ['EPFO', 'Employees\' Provident Fund Organisation'], ['ESIC', 'Employees\' State Insurance Corporation'],
  ['NSDL', 'National Securities Depository Limited'], ['CDSL', 'Central Depository Services (India) Limited'],
  ['ICAI', 'Institute of Chartered Accountants of India'], ['IIM', 'Indian Institute of Management'],
  ['IIT', 'Indian Institute of Technology'], ['AIIMS', 'All India Institute of Medical Sciences'],
  ['CBI', 'Central Bureau of Investigation'], ['CVC', 'Central Vigilance Commission'],
  ['NIA', 'National Investigation Agency'], ['ED', 'Enforcement Directorate'],
  ['FSSAI', 'Food Safety and Standards Authority of India'],
];

const CONST_FACTS = [
  ['26 January 1950', 'the date the Constitution of India came into effect'],
  ['26 November 1949', 'the date the Constitution of India was adopted'],
  ['Dr. B.R. Ambedkar', 'known as the "Father of the Indian Constitution"'],
  ['Preamble', 'the opening statement that describes the ideals of the Constitution'],
  ['Fundamental Rights', 'Part III of the Constitution guarantees these'],
  ['Directive Principles', 'Part IV of the Constitution contains these guiding principles'],
  ['Rajya Sabha', 'the upper house of Parliament'],
  ['Lok Sabha', 'the lower house of Parliament'],
  ['Prime Minister', 'the head of government in India'],
  ['President', 'the constitutional head of state in India'],
  ['Article 370', 'granted special status to Jammu and Kashmir (abrogated in 2019)'],
  ['Article 356', 'provides for President\'s Rule in a state'],
  ['42nd Amendment', 'known as the "Mini Constitution" (1976)'],
  ['Schedules', 'the Constitution originally had 8 Schedules, now there are 12'],
  ['Writ of Habeas Corpus', 'a writ demanding the production of a detained person before a court'],
  ['Writ of Mandamus', 'a writ commanding a public authority to perform its duty'],
  ['Writ of Prohibition', 'a writ stopping a lower court from exceeding its jurisdiction'],
  ['Writ of Certiorari', 'a writ quashing the order of a lower court'],
  ['Writ of Quo Warranto', 'a writ questioning the authority of a person holding a public office'],
  ['Fundamental Duties', 'Part IVA of the Constitution lists these (added by the 42nd Amendment)'],
  ['Anti-Defection Law', 'was added by the 52nd Amendment (1985) to curb political defections'],
  ['Right to Information', 'is a right derived under Article 19(1)(a) of the Constitution'],
];

const DAMS = [
  ['Bhakra Dam', 'Sutlej', 'Punjab/Himachal Pradesh'], ['Hirakud Dam', 'Mahanadi', 'Odisha'],
  ['Tehri Dam', 'Bhagirathi', 'Uttarakhand'], ['Sardar Sarovar Dam', 'Narmada', 'Gujarat'],
  ['Nagarjuna Sagar Dam', 'Krishna', 'Telangana/Andhra Pradesh'], ['Rana Pratap Sagar', 'Chambal', 'Rajasthan'],
  ['Mettur Dam', 'Cauvery', 'Tamil Nadu'], ['Koyna Dam', 'Koyna', 'Maharashtra'],
  ['Idukki Dam', 'Periyar', 'Kerala'], ['Krishna Raja Sagar Dam', 'Cauvery', 'Karnataka'],
  ['Tungabhadra Dam', 'Tungabhadra', 'Karnataka/Andhra Pradesh'], ['Indira Sagar Dam', 'Narmada', 'Madhya Pradesh'],
  ['Gandhi Sagar Dam', 'Chambal', 'Madhya Pradesh'], ['Ukai Dam', 'Tapi', 'Gujarat'],
];

const RECORDS = [
  ['the longest river in the world', 'Nile', 'Amazon', 'Yangtze', 'Mississippi'],
  ['the highest mountain peak in the world', 'Mount Everest', 'K2', 'Kanchenjunga', 'Nanda Devi'],
  ['the largest ocean', 'Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'],
  ['the largest desert in the world', 'Sahara Desert', 'Gobi Desert', 'Thar Desert', 'Kalahari Desert'],
  ['the largest continent', 'Asia', 'Africa', 'Europe', 'Antarctica'],
  ['the smallest continent', 'Australia', 'Antarctica', 'Africa', 'South America'],
  ['the largest country by area', 'Russia', 'Canada', 'China', 'United States'],
  ['the most populous country', 'India', 'China', 'United States', 'Indonesia'],
  ['the smallest country by area', 'Vatican City', 'Monaco', 'San Marino', 'Liechtenstein'],
  ['the deepest point in the world\'s oceans', 'Mariana Trench', 'Java Trench', 'Puerto Rico Trench', 'Tonga Trench'],
  ['the largest island in the world', 'Greenland', 'Madagascar', 'Borneo', 'New Guinea'],
  ['the highest waterfall in the world', 'Angel Falls', 'Niagara Falls', 'Victoria Falls', 'Iguazu Falls'],
  ['the longest river in India', 'Ganga', 'Godavari', 'Krishna', 'Brahmaputra'],
  ['the highest mountain peak in India', 'Kangchenjunga', 'K2', 'Nanda Devi', 'Anamudi'],
  ['the largest state in India by area', 'Rajasthan', 'Madhya Pradesh', 'Uttar Pradesh', 'Maharashtra'],
  ['the smallest state in India by area', 'Goa', 'Sikkim', 'Tripura', 'Mizoram'],
  ['the most populous state in India', 'Uttar Pradesh', 'Maharashtra', 'Bihar', 'West Bengal'],
  ['the highest lake in the world (highest navigable)', 'Lake Titicaca', 'Lake Superior', 'Caspian Sea', 'Loch Ness'],
  ['the largest freshwater lake in India', 'Wular Lake', 'Dal Lake', 'Chilika Lake', 'Pulicat Lake'],
  ['the longest railway platform in the world', 'Hubballi (Karnataka)', 'Gorakhpur', 'Kharagpur', 'Chennai'],
  ['the highest waterfall in India', 'Kunchikal Falls', 'Jog Falls', 'Dudhsagar', 'Barehipani'],
  ['the largest river delta in the world', 'Ganges-Brahmaputra Delta', 'Nile Delta', 'Mekong Delta', 'Amazon Delta'],
  ['the longest river in Asia', 'Yangtze', 'Ganga', 'Mekong', 'Indus'],
  ['the longest river in Africa', 'Nile', 'Congo', 'Niger', 'Zambezi'],
  ['the longest river in South America', 'Amazon', 'Parana', 'Orinoco', 'Madeira'],
  ['the largest river basin in the world', 'Amazon Basin', 'Congo Basin', 'Ganges Basin', 'Nile Basin'],
  ['the largest freshwater lake in the world', 'Lake Superior', 'Caspian Sea', 'Lake Victoria', 'Lake Baikal'],
  ['the deepest lake in the world', 'Lake Baikal', 'Lake Tanganyika', 'Caspian Sea', 'Lake Superior'],
  ['the largest saltwater lake in the world', 'Caspian Sea', 'Dead Sea', 'Aral Sea', 'Great Salt Lake'],
  ['the largest river island in the world', 'Majuli', 'Marajo', 'Bhola', 'Sagar Island'],
  ['the longest mountain range in the world', 'Andes', 'Himalayas', 'Rockies', 'Alps'],
  ['the highest plateau in the world', 'Tibetan Plateau', 'Deccan Plateau', 'Patagonian Plateau', 'Colorado Plateau'],
  ['the largest delta in India', 'Sundarban Delta', 'Kaveri Delta', 'Godavari Delta', 'Krishna Delta'],
  ['the largest lake in India', 'Chilika Lake', 'Wular Lake', 'Pulicat Lake', 'Loktak Lake'],
  ['the largest producer of rice in the world', 'China', 'India', 'Indonesia', 'Bangladesh'],
  ['the largest producer of wheat in the world', 'China', 'India', 'Russia', 'United States'],
  ['the largest producer of tea in the world', 'China', 'India', 'Kenya', 'Sri Lanka'],
  ['the largest producer of coffee in the world', 'Brazil', 'Vietnam', 'Colombia', 'India'],
  ['the largest producer of sugarcane in the world', 'Brazil', 'India', 'China', 'Thailand'],
  ['the largest producer of milk in the world', 'India', 'United States', 'China', 'Pakistan'],
  ['the longest canal in the world', 'Grand Canal (China)', 'Suez Canal', 'Panama Canal', 'Volga-Don Canal'],
  ['the largest cricket stadium in the world', 'Narendra Modi Stadium', 'Melbourne Cricket Ground', 'Eden Gardens', 'Lord\'s'],
];

const NATIONAL_PARKS = [
  ['Jim Corbett', 'Uttarakhand'], ['Kaziranga', 'Assam'], ['Sundarbans', 'West Bengal'],
  ['Ranthambore', 'Rajasthan'], ['Bandhavgarh', 'Madhya Pradesh'], ['Kanha', 'Madhya Pradesh'],
  ['Gir', 'Gujarat'], ['Periyar', 'Kerala'], ['Tadoba', 'Maharashtra'],
  ['Manas', 'Assam'],   ['Hemis', 'Ladakh'], ['Valley of Flowers', 'Uttarakhand'],
  ['Bandipur', 'Karnataka'], ['Nagarhole', 'Karnataka'], ['Mudumalai', 'Tamil Nadu'],
  ['Silent Valley', 'Kerala'], ['Pench', 'Madhya Pradesh'], ['Satpura', 'Madhya Pradesh'],
  ['Simlipal', 'Odisha'], ['Nanda Devi', 'Uttarakhand'], ['Great Himalayan', 'Himachal Pradesh'],
  ['Dachigam', 'Jammu & Kashmir'], ['Keoladeo', 'Rajasthan'],
];

const CLASSICAL_DANCES = [
  ['Bharatanatyam', 'Tamil Nadu'], ['Kathakali', 'Kerala'], ['Kathak', 'Uttar Pradesh'],
  ['Odissi', 'Odisha'], ['Kuchipudi', 'Andhra Pradesh'], ['Manipuri', 'Manipur'],
  ['Mohiniyattam', 'Kerala'], ['Sattriya', 'Assam'],
];

const INTL_ORGS = [
  ['United Nations', 'New York, USA'], ['UNESCO', 'Paris, France'], ['WHO', 'Geneva, Switzerland'],
  ['IMF', 'Washington D.C., USA'], ['World Bank', 'Washington D.C., USA'], ['NATO', 'Brussels, Belgium'],
  ['WTO', 'Geneva, Switzerland'], ['Asian Development Bank', 'Manila, Philippines'],
  ['ASEAN', 'Jakarta, Indonesia'], ['SAARC', 'Kathmandu, Nepal'], ['OPEC', 'Vienna, Austria'],
  ['INTERPOL', 'Lyon, France'],
  ['FAO', 'Rome, Italy'], ['ILO', 'Geneva, Switzerland'], ['UNHCR', 'Geneva, Switzerland'],
  ['UNCTAD', 'Geneva, Switzerland'], ['IAEA', 'Vienna, Austria'], ['UNEP', 'Nairobi, Kenya'],
  ['Amnesty International', 'London, United Kingdom'], ['Red Cross', 'Geneva, Switzerland'],
  ['European Union', 'Brussels, Belgium'], ['Commonwealth', 'London, United Kingdom'],
  ['World Economic Forum', 'Geneva, Switzerland'],
  ['World Intellectual Property Organization', 'Geneva, Switzerland'],
];

const AWARDS = [
  ['Bharat Ratna', 'India\'s highest civilian award'],
  ['Param Vir Chakra', 'India\'s highest wartime military decoration'],
  ['Ashoka Chakra', 'India\'s highest peacetime military decoration'],
  ['Jnanpith Award', 'India\'s highest literary honour'],
  ['Dadasaheb Phalke Award', 'India\'s highest award in cinema'],
  ['Arjuna Award', 'given for outstanding performance in sports'],
  ['Major Dhyan Chand Khel Ratna', 'India\'s highest sporting honour'],
  ['Nobel Prize', 'internationally prestigious award founded by Alfred Nobel'],
  ['Academy Award (Oscar)', 'highest award in the international film industry'],
  ['Padma Vibhushan', 'the second-highest civilian award of India'],
  ['Padma Bhushan', 'the third-highest civilian award of India'],
  ['Padma Shri', 'the fourth-highest civilian award of India'],
  ['Sahitya Akademi Award', 'a literary honour given by the Sahitya Akademi'],
  ['Dronacharya Award', 'given to outstanding sports coaches in India'],
  ['Major Dhyan Chand Khel Ratna', 'India\'s highest sporting honour'],
  ['Gandhi Peace Prize', 'India\'s international award for social work, named after Mahatma Gandhi'],
  ['Booker Prize', 'a prestigious literary prize for English-language fiction'],
  ['Pulitzer Prize', 'an American award for excellence in journalism and literature'],
];

const RIVERS_INDIA = [
  ['Ganga', 'flows through Varanasi and is the holiest river of India'],
  ['Yamuna', 'flows past Delhi and Agra, where the Taj Mahal stands on its bank'],
  ['Godavari', 'is the longest river of southern India'],
  ['Krishna', 'flows through Maharashtra, Karnataka and Telangana/Andhra Pradesh'],
  ['Narmada', 'flows westward through Madhya Pradesh into the Arabian Sea'],
  ['Brahmaputra', 'flows through Assam and enters Bangladesh'],
  ['Kaveri', 'flows through Karnataka and Tamil Nadu'],
  ['Mahanadi', 'flows through Odisha'],
  ['Indus', 'now flows mainly through Pakistan'],
  ['Sutlej', 'is a tributary of the Indus and flows through Punjab'],
  ['Tapi (Tapti)', 'flows westward through Maharashtra and Gujarat'],
  ['Chambal', 'is a tributary of the Yamuna flowing through Madhya Pradesh and Rajasthan'],
  ['Beas', 'flows through Himachal Pradesh and Punjab'],
  ['Ravi', 'flows through Himachal Pradesh and Punjab as part of the Indus system'],
  ['Jhelum', 'flows through the Kashmir Valley and into Pakistan'],
  ['Chenab', 'is formed in Himachal Pradesh and flows through Punjab'],
  ['Ghaghara', 'is a tributary of the Ganga flowing through Nepal and Uttar Pradesh'],
  ['Son', 'is a tributary of the Ganga flowing through Madhya Pradesh and Bihar'],
  ['Damodar', 'flows through Jharkhand and West Bengal, called the "Sorrow of Bengal"'],
  ['Subarnarekha', 'flows through Jharkhand, Odisha and West Bengal'],
  ['Tungabhadra', 'is a tributary of the Krishna formed in Karnataka'],
];

const MONUMENTS = [
  ['Taj Mahal', 'Agra, Uttar Pradesh'], ['Red Fort', 'Delhi'], ['Qutub Minar', 'Delhi'],
  ['India Gate', 'Delhi'], ['Gateway of India', 'Mumbai, Maharashtra'],
  ['Charminar', 'Hyderabad, Telangana'], ['Golden Temple', 'Amritsar, Punjab'],
  ['Mysore Palace', 'Mysuru, Karnataka'], ['Hawa Mahal', 'Jaipur, Rajasthan'],
  ['Konark Sun Temple', 'Odisha'], ['Hampi', 'Karnataka'], ['Ajanta Caves', 'Maharashtra'],
  ['Ellora Caves', 'Maharashtra'], ['Sanchi Stupa', 'Madhya Pradesh'], ['Khajuraho Temples', 'Madhya Pradesh'],
  ['Meenakshi Temple', 'Madurai, Tamil Nadu'], ['Vivekananda Rock Memorial', 'Kanyakumari, Tamil Nadu'],
  ['Jama Masjid', 'Delhi'], ['Humayun\'s Tomb', 'Delhi'], ['Lotus Temple', 'Delhi'],
  ['Victoria Memorial', 'Kolkata, West Bengal'], ['Howrah Bridge', 'Kolkata, West Bengal'],
  ['Mahabodhi Temple', 'Bodh Gaya, Bihar'],
];

const PEAKS_INDIA = [
  ['Kangchenjunga', 'is the highest peak in India, located in Sikkim'],
  ['Nanda Devi', 'is the highest peak lying entirely within India (Uttarakhand)'],
  ['Anamudi', 'is the highest peak of the Western Ghats, in Kerala'],
  ['Doda Betta', 'is the highest peak of the Nilgiri Hills, in Tamil Nadu'],
  ['Guru Shikhar', 'is the highest peak of the Aravalli Range, in Rajasthan'],
  ['Kalsubai', 'is the highest peak of Maharashtra'],
  ['Saser Kangri', 'is the second-highest peak of India, located in Ladakh'],
  ['Kamet', 'is a high peak in the Garhwal region of Uttarakhand'],
  ['Trisul', 'is a peak in the Kumaon region of Uttarakhand'],
  ['Sandakphu', 'is the highest peak of West Bengal'],
  ['Phawngpui (Blue Mountain)', 'is the highest peak of Mizoram'],
];

// state, official/major language
const OFFICIAL_LANGUAGES = [
  ['Andhra Pradesh', 'Telugu'], ['Arunachal Pradesh', 'English'], ['Assam', 'Assamese'],
  ['Bihar', 'Hindi'], ['Chhattisgarh', 'Hindi'], ['Goa', 'Konkani'],
  ['Gujarat', 'Gujarati'], ['Haryana', 'Hindi'], ['Himachal Pradesh', 'Hindi'],
  ['Jharkhand', 'Hindi'], ['Karnataka', 'Kannada'], ['Kerala', 'Malayalam'],
  ['Madhya Pradesh', 'Hindi'], ['Maharashtra', 'Marathi'], ['Manipur', 'Manipuri'],
  ['Meghalaya', 'English'], ['Mizoram', 'Mizo'], ['Nagaland', 'English'],
  ['Odisha', 'Odia'], ['Punjab', 'Punjabi'], ['Rajasthan', 'Hindi'],
  ['Sikkim', 'English'], ['Tamil Nadu', 'Tamil'], ['Telangana', 'Telugu'],
  ['Tripura', 'Bengali'], ['Uttar Pradesh', 'Hindi'], ['Uttarakhand', 'Hindi'],
  ['West Bengal', 'Bengali'],
];

// union territory, capital
const UT_CAPITALS = [
  ['Delhi (NCT)', 'New Delhi'], ['Puducherry', 'Puducherry'], ['Chandigarh', 'Chandigarh'],
  ['Ladakh', 'Leh'], ['Lakshadweep', 'Kavaratti'], ['Andaman & Nicobar Islands', 'Port Blair'],
  ['Jammu & Kashmir', 'Srinagar (summer) and Jammu (winter)'],
  ['Dadra & Nagar Haveli and Daman & Diu', 'Daman'],
];

// what, answer
const NATIONAL_SYMBOLS = [
  ['national flag', 'a tricolour flag with a navy-blue Ashoka Chakra'],
  ['national emblem', 'the Lion Capital of Ashoka, taken from Sarnath'],
  ['national animal', 'the Bengal Tiger'], ['national bird', 'the Indian Peacock'],
  ['national flower', 'the Lotus'], ['national tree', 'the Banyan'],
  ['national fruit', 'the Mango'], ['national aquatic animal', 'the Ganges River Dolphin'],
  ['national heritage animal', 'the Indian Elephant'],
  ['national anthem', '"Jana Gana Mana" written by Rabindranath Tagore'],
  ['national song', '"Vande Mataram" written by Bankim Chandra Chatterjee'],
  ['national motto', '"Satyameva Jayate", taken from the Mundaka Upanishad'],
];

// president, descriptor
const PRESIDENTS = [
  ['Dr. Rajendra Prasad', 'the first President of India (1950\u201362)'],
  ['Dr. S. Radhakrishnan', 'a philosopher who served as the second President'],
  ['Dr. Zakir Husain', 'the first Muslim President of India'],
  ['V.V. Giri', 'the President who first served as acting President'],
  ['Fakhruddin Ali Ahmed', 'the President of India during the 1975\u201377 Emergency'],
  ['Neelam Sanjiva Reddy', 'the President who was elected unopposed'],
  ['Giani Zail Singh', 'the first Sikh President of India'],
  ['R. Venkataraman', 'the President of India from 1987 to 1992'],
  ['Dr. Shankar Dayal Sharma', 'the President of India from 1992 to 1997'],
  ['K.R. Narayanan', 'the first Dalit President of India'],
  ['Dr. A.P.J. Abdul Kalam', 'the scientist known as the Missile Man who became President in 2002'],
  ['Pratibha Patil', 'the first woman President of India'],
  ['Pranab Mukherjee', 'the President who was a former Finance Minister of India'],
  ['Ram Nath Kovind', 'the President of India from 2017 to 2022'],
  ['Droupadi Murmu', 'the first tribal President of India'],
];

// prime minister, descriptor
const PRIME_MINISTERS = [
  ['Jawaharlal Nehru', 'the first Prime Minister of India'],
  ['Lal Bahadur Shastri', 'the Prime Minister who gave the slogan "Jai Jawan Jai Kisan"'],
  ['Indira Gandhi', 'the first woman Prime Minister of India'],
  ['Morarji Desai', 'the first non-Congress Prime Minister of India'],
  ['Charan Singh', 'the Prime Minister of India during 1979\u201380'],
  ['Rajiv Gandhi', 'the youngest Prime Minister of India'],
  ['V.P. Singh', 'the Prime Minister who implemented the Mandal Commission report'],
  ['P.V. Narasimha Rao', 'the Prime Minister during the 1991 economic reforms'],
  ['H.D. Deve Gowda', 'the Prime Minister of India during 1996\u201397'],
  ['I.K. Gujral', 'the Prime Minister associated with the "Gujral Doctrine"'],
  ['Atal Bihari Vajpayee', 'the first Prime Minister from the BJP'],
  ['Dr. Manmohan Singh', 'the architect of the 1991 reforms who became Prime Minister in 2004'],
  ['Narendra Modi', 'the Prime Minister of India since 2014'],
];

// name, field/year
const NOBEL_INDIANS = [
  ['Rabindranath Tagore', 'won the Nobel Prize in Literature in 1913'],
  ['C.V. Raman', 'won the Nobel Prize in Physics in 1930'],
  ['Har Gobind Khorana', 'won the Nobel Prize in Medicine in 1968'],
  ['Mother Teresa', 'won the Nobel Peace Prize in 1979'],
  ['Subrahmanyan Chandrasekhar', 'won the Nobel Prize in Physics in 1983'],
  ['Amartya Sen', 'won the Nobel Prize in Economics in 1998'],
  ['Venkatraman Ramakrishnan', 'won the Nobel Prize in Chemistry in 2009'],
  ['Kailash Satyarthi', 'won the Nobel Peace Prize in 2014'],
  ['Abhijit Banerjee', 'won the Nobel Prize in Economics in 2019'],
];

// temple, location
const TEMPLES = [
  ['Meenakshi Temple', 'Madurai, Tamil Nadu'], ['Tirupati Balaji Temple', 'Tirupati, Andhra Pradesh'],
  ['Somnath Temple', 'Gujarat'], ['Kashi Vishwanath Temple', 'Varanasi, Uttar Pradesh'],
  ['Kedarnath Temple', 'Uttarakhand'], ['Badrinath Temple', 'Uttarakhand'],
  ['Jagannath Temple', 'Puri, Odisha'], ['Vaishno Devi Temple', 'Katra, Jammu & Kashmir'],
  ['Shirdi Sai Baba Temple', 'Shirdi, Maharashtra'], ['Rameswaram Temple', 'Tamil Nadu'],
  ['Dwarkadhish Temple', 'Dwarka, Gujarat'], ['Brihadeeswarar Temple', 'Thanjavur, Tamil Nadu'],
];

// port, state
const PORTS_INDIA = [
  ['Deendayal (Kandla)', 'Gujarat'], ['Jawaharlal Nehru Port (Nhava Sheva)', 'Maharashtra'],
  ['Mumbai Port', 'Maharashtra'], ['Chennai Port', 'Tamil Nadu'],
  ['Kolkata (Haldia)', 'West Bengal'], ['Visakhapatnam Port', 'Andhra Pradesh'],
  ['Paradip Port', 'Odisha'], ['Mundra Port', 'Gujarat'],
  ['Cochin Port', 'Kerala'], ['Mormugao Port', 'Goa'],
  ['V.O. Chidambaranar (Tuticorin)', 'Tamil Nadu'], ['New Mangalore Port', 'Karnataka'],
];

// seat city, state
const HIGH_COURTS = [
  ['Allahabad', 'Uttar Pradesh'], ['Bombay', 'Maharashtra'], ['Calcutta', 'West Bengal'],
  ['Madras', 'Tamil Nadu'], ['Delhi', 'Delhi'], ['Hyderabad', 'Telangana'],
  ['Guwahati', 'Assam'], ['Patna', 'Bihar'], ['Raipur', 'Chhattisgarh'],
  ['Chandigarh', 'Punjab and Haryana'], ['Bengaluru', 'Karnataka'], ['Kochi', 'Kerala'],
  ['Bhopal', 'Madhya Pradesh'], ['Ahmedabad', 'Gujarat'], ['Cuttack', 'Odisha'],
  ['Jaipur', 'Rajasthan'], ['Gangtok', 'Sikkim'], ['Imphal', 'Manipur'],
];

// plant, state
const NUCLEAR_PLANTS = [
  ['Tarapur', 'Maharashtra'], ['Kudankulam', 'Tamil Nadu'], ['Kakrapar', 'Gujarat'],
  ['Kaiga', 'Karnataka'], ['Narora', 'Uttar Pradesh'], ['Rawatbhata', 'Rajasthan'],
  ['Kalpakkam (Madras)', 'Tamil Nadu'], ['Gorakhpur', 'Haryana'],
];

// refinery, state
const REFINERIES = [
  ['Jamnagar', 'Gujarat'], ['Mathura', 'Uttar Pradesh'], ['Panipat', 'Haryana'],
  ['Barauni', 'Bihar'], ['Kochi', 'Kerala'], ['Visakhapatnam', 'Andhra Pradesh'],
  ['Guwahati', 'Assam'], ['Bongaigaon', 'Assam'], ['Haldia', 'West Bengal'],
  ['Manali (Chennai)', 'Tamil Nadu'],
];

// lake, state
const LAKES_INDIA = [
  ['Wular Lake', 'Jammu & Kashmir'], ['Dal Lake', 'Jammu & Kashmir'], ['Chilika Lake', 'Odisha'],
  ['Pulicat Lake', 'Andhra Pradesh and Tamil Nadu'], ['Sambhar Lake', 'Rajasthan'],
  ['Loktak Lake', 'Manipur'], ['Naini Lake', 'Uttarakhand'], ['Bhimtal Lake', 'Uttarakhand'],
  ['Kolleru Lake', 'Andhra Pradesh'], ['Pangong Tso', 'Ladakh'], ['Vembanad Lake', 'Kerala'],
  ['Hussain Sagar Lake', 'Telangana'],
];

// pass, region
const PASSES_INDIA = [
  ['Zoji La', 'Ladakh'], ['Nathu La', 'Sikkim'], ['Shipki La', 'Himachal Pradesh'],
  ['Rohtang Pass', 'Himachal Pradesh'], ['Khardung La', 'Ladakh'],
  ['Bomdila Pass', 'Arunachal Pradesh'], ['Palghat Gap', 'Kerala and Tamil Nadu'],
  ['Banihal Pass', 'Jammu & Kashmir'],
];

// tribe, state
const TRIBES_INDIA = [
  ['Gonds', 'Madhya Pradesh'], ['Santhals', 'Jharkhand'], ['Bhils', 'Rajasthan'],
  ['Bodos', 'Assam'], ['Nagas', 'Nagaland'], ['Todas', 'Tamil Nadu'],
  ['Jarawa', 'Andaman & Nicobar Islands'], ['Khasis', 'Meghalaya'], ['Mundas', 'Jharkhand'],
];

// festival, region
const FESTIVALS = [
  ['Pongal', 'Tamil Nadu'], ['Bihu', 'Assam'], ['Onam', 'Kerala'],
  ['Chhath Puja', 'Bihar'], ['Rath Yatra', 'Odisha'], ['Hornbill Festival', 'Nagaland'],
  ['Losar', 'Ladakh'], ['Chapchar Kut', 'Mizoram'], ['Baisakhi', 'Punjab'],
  ['Ganesh Chaturthi', 'Maharashtra'], ['Durga Puja', 'West Bengal'], ['Ambubachi Mela', 'Assam'],
  ['Hemis Festival', 'Ladakh'],
];

// dance, state
const FOLK_DANCES = [
  ['Garba', 'Gujarat'], ['Bhangra', 'Punjab'], ['Ghoomar', 'Rajasthan'],
  ['Lavani', 'Maharashtra'], ['Kalbelia', 'Rajasthan'], ['Chhau', 'Jharkhand'],
  ['Thang Ta', 'Manipur'], ['Cheraw (Bamboo Dance)', 'Mizoram'], ['Yakshagana', 'Karnataka'],
  ['Theyyam', 'Kerala'], ['Bhavai', 'Gujarat'],
];

// biosphere reserve, state
const BIOSPHERE_RESERVES = [
  ['Nilgiri', 'Tamil Nadu, Kerala and Karnataka'], ['Sundarbans', 'West Bengal'],
  ['Nanda Devi', 'Uttarakhand'], ['Gulf of Mannar', 'Tamil Nadu'], ['Simlipal', 'Odisha'],
  ['Kanchanjunga', 'Sikkim'], ['Dibru-Saikhowa', 'Assam'], ['Agasthyamalai', 'Kerala and Tamil Nadu'],
  ['Great Nicobar', 'Andaman & Nicobar Islands'],
];

// mission, descriptor
const SPACE_MISSIONS = [
  ['Chandrayaan-1', 'India\'s first lunar mission, launched in 2008'],
  ['Chandrayaan-3', 'the 2023 mission that landed near the Moon\'s south pole'],
  ['Mangalyaan (MOM)', 'India\'s Mars orbiter, launched in 2013'],
  ['Aditya-L1', 'India\'s solar observatory mission, launched in 2023'],
  ['Gaganyaan', 'India\'s planned crewed space mission'],
  ['AstroSat', 'India\'s first dedicated space telescope'],
  ['PSLV', 'the workhorse launch vehicle of ISRO'],
  ['GSLV', 'the geosynchronous launch vehicle of ISRO'],
  ['NISAR', 'a joint NASA-ISRO Earth observation satellite'],
];

// force, descriptor
const DEFENCE_FORCES = [
  ['BSF', 'guards India\'s international borders with Pakistan and Bangladesh'],
  ['CRPF', 'the largest central armed police force of India'],
  ['CISF', 'provides security to airports, metros and key installations'],
  ['ITBP', 'guards India\'s border with China along the Indo-Tibetan border'],
  ['SSB', 'guards the Indo-Nepal and Indo-Bhutan borders (Sashastra Seema Bal)'],
  ['NSG', 'the specialised counter-terrorism force known as "Black Cats"'],
  ['Indian Coast Guard', 'protects India\'s maritime interests and coastal security'],
  ['R&AW', 'India\'s foreign intelligence agency'],
  ['Intelligence Bureau', 'India\'s internal intelligence agency'],
  ['NIA', 'investigates cases of terrorism and national security'],
];

// airport, city
const AIRPORTS = [
  ['Indira Gandhi International', 'Delhi'], ['Chhatrapati Shivaji Maharaj', 'Mumbai'],
  ['Kempegowda', 'Bengaluru'], ['Netaji Subhas Chandra Bose', 'Kolkata'],
  ['Rajiv Gandhi', 'Hyderabad'], ['Chennai International (Anna)', 'Chennai'],
  ['Sardar Vallabhbhai Patel', 'Ahmedabad'], ['Cochin International', 'Kochi'],
  ['Dabolim', 'Goa'], ['Pune (Lohegaon)', 'Pune'],
];

// railway zone, headquarters city
const RAILWAY_ZONES = [
  ['Central', 'Mumbai'], ['Western', 'Mumbai'], ['Northern', 'New Delhi'],
  ['Southern', 'Chennai'], ['Eastern', 'Kolkata'], ['South Eastern', 'Kolkata'],
  ['North Western', 'Jaipur'], ['East Central', 'Hajipur'], ['South Central', 'Secunderabad'],
  ['North Eastern', 'Gorakhpur'], ['South Western', 'Hubballi'], ['North Central', 'Prayagraj'],
];

// note, feature
const CURRENCY_NOTES = [
  ['\u20B910', 'the Konark Sun Temple on its reverse'],
  ['\u20B920', 'the Ellora Caves on its reverse'],
  ['\u20B950', 'Hampi on its reverse'],
  ['\u20B9100', 'Rani ki Vav on its reverse'],
  ['\u20B9200', 'the Sanchi Stupa on its reverse'],
  ['\u20B9500', 'the Red Fort on its reverse'],
  ['\u20B92000', 'the Mangalyaan spacecraft on its reverse'],
];

// name, descriptor
const OLYMPIC_HEROES = [
  ['Abhinav Bindra', 'won India\'s first individual Olympic gold medal (2008)'],
  ['Neeraj Chopra', 'won India\'s first Olympic gold in track and field (2021)'],
  ['PV Sindhu', 'was the first Indian woman to win two Olympic medals'],
  ['Saina Nehwal', 'won India\'s first Olympic medal in badminton (2012)'],
  ['Leander Paes', 'won India\'s first Olympic medal in tennis (1996)'],
  ['Karnam Malleswari', 'was the first Indian woman to win an Olympic medal (2000)'],
  ['Mary Kom', 'was the first Indian woman boxer to win an Olympic medal (2012)'],
  ['Sakshi Malik', 'was the first Indian woman wrestler to win an Olympic medal (2016)'],
  ['Sushil Kumar', 'was the first Indian to win two individual Olympic medals in wrestling'],
  ['Dhyan Chand', 'won three Olympic gold medals in hockey (1928, 1932, 1936)'],
  ['Milkha Singh', 'is popularly known as the "Flying Sikh"'],
];

function genCapitals(rng) {
  return COUNTRIES.map(([country, capital, cur]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'World Capitals',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'capitals'],
    question_text: `What is the capital of ${country}?`,
    correct: capital,
    distractors: shuffle(rng, COUNTRIES.filter(c => c[0] !== country).map(c => c[1])).slice(0, 4),
    explanation: `The capital of ${country} is ${capital}.`
  }));
}

function genCountryFromCapital(rng) {
  return shuffle(rng, COUNTRIES).map(([country, capital, cur]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'World Capitals',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'capitals'],
    question_text: `${capital} is the capital of which country?`,
    correct: country,
    distractors: shuffle(rng, COUNTRIES.filter(c => c[1] !== capital).map(c => c[0])).slice(0, 4),
    explanation: `${capital} is the capital of ${country}.`
  }));
}

function genCurrencies(rng) {
  const pool = COUNTRIES.filter((v, i, a) => a.findIndex(x => x[2] === v[2]) === i);
  return pool.map(([country, capital, cur]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Currencies',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'currency'],
    question_text: `What is the currency of ${country}?`,
    correct: cur,
    distractors: shuffle(rng, pool.filter(c => c[2] !== cur).map(c => c[2])).slice(0, 4),
    explanation: `The currency of ${country} is the ${cur}.`
  }));
}

function genStateCapitals(rng) {
  return STATES.map(([state, capital]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Indian States & Capitals',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'states'],
    question_text: `What is the capital of ${state}?`,
    correct: capital,
    distractors: shuffle(rng, STATES.filter(s => s[0] !== state).map(s => s[1])).slice(0, 4),
    explanation: `The capital of ${state} is ${capital}.`
  }));
}

function genDays(rng) {
  return DAYS.map(([date, name]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Important Days',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'days'],
    question_text: `${name} is observed on?`,
    correct: date,
    distractors: shuffle(rng, DAYS.filter(d => d[1] !== name).map(d => d[0])).slice(0, 4),
    explanation: `${name} is observed on ${date}.`
  }));
}

function genBankingTerms(rng) {
  return BANKING_TERMS.map(([term, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Banking Awareness', subtopic: 'Banking Terms',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'banking', 'terms'],
    question_text: `In banking, what does ${term} refer to?`,
    correct: desc,
    distractors: shuffle(rng, BANKING_TERMS.filter(t => t[0] !== term).map(t => t[1])).slice(0, 4),
    explanation: `${term}: ${desc}.`
  }));
}

function genBankFacts(rng) {
  return BANK_FACTS.map(([name, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Banking Awareness', subtopic: 'Banking System',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'banking'],
    question_text: `Which of the following is true — ${desc}?`,
    correct: name,
    distractors: shuffle(rng, BANK_FACTS.filter(f => f[0] !== name).map(f => f[0])).slice(0, 4),
    explanation: `${name} — ${desc}.`
  }));
}

function genSchemes(rng) {
  const rows = [];
  for (const [name, desc, year] of SCHEMES) {
    rows.push(buildQ(rng, {
      subject: 'General Awareness', topic: 'Banking Awareness', subtopic: 'Government Schemes',
      difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'schemes'],
      question_text: `Which government scheme ${desc}?`,
      correct: name,
      distractors: shuffle(rng, SCHEMES.filter(s => s[0] !== name).map(s => s[0])).slice(0, 4),
      explanation: `${name} was launched in ${year} to ${desc}.`
    }));
  }
  return rows;
}

function genBooks(rng) {
  return BOOKS.map(([book, author]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Books & Authors',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'books'],
    question_text: `Who wrote the book "${book}"?`,
    correct: author,
    distractors: shuffle(rng, BOOKS.filter(b => b[0] !== book).map(b => b[1])).slice(0, 4),
    explanation: `"${book}" was written by ${author}.`
  }));
}

function genEconomy(rng) {
  return ECONOMY.map(([term, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Economy', subtopic: 'Economic Terms',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'economy', 'terms'],
    question_text: `What does ${term} stand for / refer to?`,
    correct: desc,
    distractors: shuffle(rng, ECONOMY.filter(e => e[0] !== term).map(e => e[1])).slice(0, 4),
    explanation: `${term}: ${desc}.`
  }));
}

function genFirsts(rng) {
  return FIRSTS.map(([person, feat]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Firsts & Records',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'firsts'],
    question_text: `Who was ${feat}?`,
    correct: person,
    distractors: shuffle(rng, FIRSTS.filter(f => f[0] !== person).map(f => f[0])).slice(0, 4),
    explanation: `${person} was ${feat}.`
  }));
}

function genSports(rng) {
  return SPORTS.map(([sport, trophy]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Sports & Trophies',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'sports'],
    question_text: `Which of the following is the ${trophy} associated with?`,
    correct: sport,
    distractors: shuffle(rng, SPORTS.filter(s => s[0] !== sport).map(s => s[0])).slice(0, 4),
    explanation: `The ${trophy} is associated with ${sport}.`
  }));
}

function genAbbr(rng) {
  return GA_ABBR.map(([abbr, full]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Abbreviations',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'abbr'],
    question_text: `What is the full form of ${abbr}?`,
    correct: full,
    distractors: shuffle(rng, GA_ABBR.filter(a => a[0] !== abbr).map(a => a[1])).slice(0, 4),
    explanation: `${abbr} stands for ${full}.`
  }));
}

function genConst(rng) {
  return CONST_FACTS.map(([name, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Indian Polity',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'polity'],
    question_text: `Which of the following correctly describes — ${desc}?`,
    correct: name,
    distractors: shuffle(rng, CONST_FACTS.filter(c => c[0] !== name).map(c => c[0])).slice(0, 4),
    explanation: `${name} — ${desc}.`
  }));
}

function genDams(rng) {
  return DAMS.map(([dam, river, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Dams & Rivers',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'dams'],
    question_text: `Which river is the ${dam} built on?`,
    correct: river,
    distractors: shuffle(rng, DAMS.filter(d => d[0] !== dam).map(d => d[1])).slice(0, 4),
    explanation: `${dam} is built on the ${river} river (${state}).`
  }));
}

function genRecords(rng) {
  return RECORDS.map(([q, correct, ...wrong]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'World Records & Superlatives',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'records'],
    question_text: `What is ${q}?`,
    correct,
    distractors: wrong,
    explanation: `${q}: ${correct}.`
  }));
}

function genNationalParks(rng) {
  return NATIONAL_PARKS.map(([park, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'National Parks of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'parks'],
    question_text: `In which state is the ${park} National Park located?`,
    correct: state,
    distractors: shuffle(rng, NATIONAL_PARKS.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `${park} National Park is located in ${state}.`
  }));
}

function genDances(rng) {
  return CLASSICAL_DANCES.map(([dance, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Classical Dance Forms',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'dance'],
    question_text: `${dance} is the classical dance form of which Indian state?`,
    correct: state,
    distractors: shuffle(rng, CLASSICAL_DANCES.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `${dance} is a classical dance form of ${state}.`
  }));
}

function genIntlOrgs(rng) {
  return INTL_ORGS.map(([org, hq]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'International Organizations',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'orgs'],
    question_text: `What is the headquarters of the ${org}?`,
    correct: hq,
    distractors: shuffle(rng, INTL_ORGS.filter(x => x[1] !== hq).map(x => x[1])).slice(0, 4),
    explanation: `The headquarters of the ${org} is in ${hq}.`
  }));
}

function genAwards(rng) {
  return AWARDS.map(([name, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Awards & Honours',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'awards'],
    question_text: `Which award is ${desc}?`,
    correct: name,
    distractors: shuffle(rng, AWARDS.filter(x => x[0] !== name).map(x => x[0])).slice(0, 4),
    explanation: `${name} is ${desc}.`
  }));
}

function genRiversIndia(rng) {
  return RIVERS_INDIA.map(([river, clue]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Rivers of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'rivers'],
    question_text: `Which river ${clue}?`,
    correct: river,
    distractors: shuffle(rng, RIVERS_INDIA.filter(x => x[0] !== river).map(x => x[0])).slice(0, 4),
    explanation: `${river} ${clue}.`
  }));
}

function genMonuments(rng) {
  return MONUMENTS.map(([mon, loc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Monuments of India',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'monuments'],
    question_text: `The ${mon} is located in which of the following places?`,
    correct: loc,
    distractors: shuffle(rng, MONUMENTS.filter(x => x[0] !== mon).map(x => x[1])).slice(0, 4),
    explanation: `The ${mon} is located in ${loc}.`
  }));
}

function genPeaks(rng) {
  return PEAKS_INDIA.map(([peak, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Mountains & Peaks',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'peaks'],
    question_text: `Which peak ${desc}?`,
    correct: peak,
    distractors: shuffle(rng, PEAKS_INDIA.filter(x => x[0] !== peak).map(x => x[0])).slice(0, 4),
    explanation: `${peak} ${desc}.`
  }));
}

function genLanguages(rng) {
  return OFFICIAL_LANGUAGES.map(([state, lang]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Official Languages',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'languages'],
    question_text: `What is the official language of the state of ${state}?`,
    correct: lang,
    distractors: shuffle(rng, OFFICIAL_LANGUAGES.filter(x => x[1] !== lang).map(x => x[1])).slice(0, 4),
    explanation: `The official language of ${state} is ${lang}.`
  }));
}

function genUTCapitals(rng) {
  return UT_CAPITALS.map(([ut, cap]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Union Territories',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'ut'],
    question_text: `What is the capital of the union territory of ${ut}?`,
    correct: cap,
    distractors: shuffle(rng, UT_CAPITALS.filter(x => x[1] !== cap).map(x => x[1])).slice(0, 4),
    explanation: `The capital of ${ut} is ${cap}.`
  }));
}

function genSymbols(rng) {
  return NATIONAL_SYMBOLS.map(([what, answer]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'National Symbols',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'symbols'],
    question_text: `Which of the following is the ${what} of India?`,
    correct: answer,
    distractors: shuffle(rng, NATIONAL_SYMBOLS.filter(x => x[1] !== answer).map(x => x[1])).slice(0, 4),
    explanation: `The ${what} of India is ${answer}.`
  }));
}

function genPresidents(rng) {
  return PRESIDENTS.map(([name, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Presidents of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'presidents'],
    question_text: `Which of the following correctly describes — ${desc}?`,
    correct: name,
    distractors: shuffle(rng, PRESIDENTS.filter(x => x[0] !== name).map(x => x[0])).slice(0, 4),
    explanation: `${name} — ${desc}.`
  }));
}

function genPrimeMinisters(rng) {
  return PRIME_MINISTERS.map(([name, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Prime Ministers of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'pm'],
    question_text: `Which of the following correctly describes — ${desc}?`,
    correct: name,
    distractors: shuffle(rng, PRIME_MINISTERS.filter(x => x[0] !== name).map(x => x[0])).slice(0, 4),
    explanation: `${name} — ${desc}.`
  }));
}

function genNobelIndians(rng) {
  return NOBEL_INDIANS.map(([name, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Nobel Laureates',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'nobel'],
    question_text: `Which Indian personality ${desc}?`,
    correct: name,
    distractors: shuffle(rng, NOBEL_INDIANS.filter(x => x[0] !== name).map(x => x[0])).slice(0, 4),
    explanation: `${name} ${desc}.`
  }));
}

function genTemples(rng) {
  return TEMPLES.map(([temple, loc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Temples of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'temples'],
    question_text: `The ${temple} is located in which of the following places?`,
    correct: loc,
    distractors: shuffle(rng, TEMPLES.filter(x => x[0] !== temple).map(x => x[1])).slice(0, 4),
    explanation: `The ${temple} is located in ${loc}.`
  }));
}

function genPorts(rng) {
  return PORTS_INDIA.map(([port, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Ports of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'ports'],
    question_text: `In which state is the ${port} port located?`,
    correct: state,
    distractors: shuffle(rng, PORTS_INDIA.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `The ${port} port is located in ${state}.`
  }));
}

function genHighCourts(rng) {
  return HIGH_COURTS.map(([city, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'High Courts of India',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'courts'],
    question_text: `The High Court of ${state} has its seat at which city?`,
    correct: city,
    distractors: shuffle(rng, HIGH_COURTS.filter(x => x[1] !== state).map(x => x[0])).slice(0, 4),
    explanation: `The High Court of ${state} sits at ${city}.`
  }));
}

function genNuclearPlants(rng) {
  return NUCLEAR_PLANTS.map(([plant, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Nuclear Power Plants',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'nuclear'],
    question_text: `The ${plant} nuclear power plant is located in which state?`,
    correct: state,
    distractors: shuffle(rng, NUCLEAR_PLANTS.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `The ${plant} nuclear power plant is located in ${state}.`
  }));
}

function genRefineries(rng) {
  return REFINERIES.map(([ref, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Oil Refineries',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'refineries'],
    question_text: `The ${ref} oil refinery is located in which state?`,
    correct: state,
    distractors: shuffle(rng, REFINERIES.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `The ${ref} oil refinery is located in ${state}.`
  }));
}

function genLakes(rng) {
  return LAKES_INDIA.map(([lake, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Lakes of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'lakes'],
    question_text: `In which state is the ${lake} located?`,
    correct: state,
    distractors: shuffle(rng, LAKES_INDIA.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `The ${lake} is located in ${state}.`
  }));
}

function genPasses(rng) {
  return PASSES_INDIA.map(([passName, region]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Mountain Passes',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'passes'],
    question_text: `The ${passName} pass is located in which region?`,
    correct: region,
    distractors: shuffle(rng, PASSES_INDIA.filter(x => x[1] !== region).map(x => x[1])).slice(0, 4),
    explanation: `The ${passName} pass is located in ${region}.`
  }));
}

function genTribes(rng) {
  return TRIBES_INDIA.map(([tribe, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Tribes of India',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'tribes'],
    question_text: `The ${tribe} tribe is mainly found in which state?`,
    correct: state,
    distractors: shuffle(rng, TRIBES_INDIA.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `The ${tribe} tribe is mainly found in ${state}.`
  }));
}

function genFestivals(rng) {
  return FESTIVALS.map(([festival, region]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Festivals of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'festivals'],
    question_text: `The festival of ${festival} is mainly celebrated in which state?`,
    correct: region,
    distractors: shuffle(rng, FESTIVALS.filter(x => x[1] !== region).map(x => x[1])).slice(0, 4),
    explanation: `${festival} is mainly celebrated in ${region}.`
  }));
}

function genFolkDances(rng) {
  return FOLK_DANCES.map(([dance, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Folk Dance Forms',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'dance'],
    question_text: `${dance} is a folk dance form of which state?`,
    correct: state,
    distractors: shuffle(rng, FOLK_DANCES.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `${dance} is a folk dance form of ${state}.`
  }));
}

function genBiosphere(rng) {
  return BIOSPHERE_RESERVES.map(([name, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Biosphere Reserves',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'biosphere'],
    question_text: `The ${name} Biosphere Reserve is located in which state?`,
    correct: state,
    distractors: shuffle(rng, BIOSPHERE_RESERVES.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `The ${name} Biosphere Reserve is located in ${state}.`
  }));
}

function genSpace(rng) {
  return SPACE_MISSIONS.map(([mission, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'ISRO & Space Missions',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'space'],
    question_text: `Which ISRO mission ${desc}?`,
    correct: mission,
    distractors: shuffle(rng, SPACE_MISSIONS.filter(x => x[0] !== mission).map(x => x[0])).slice(0, 4),
    explanation: `${mission} ${desc}.`
  }));
}

function genDefence(rng) {
  return DEFENCE_FORCES.map(([name, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Defence & Security Forces',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'defence'],
    question_text: `Which of the following forces ${desc}?`,
    correct: name,
    distractors: shuffle(rng, DEFENCE_FORCES.filter(x => x[0] !== name).map(x => x[0])).slice(0, 4),
    explanation: `${name} ${desc}.`
  }));
}

function genAirports(rng) {
  return AIRPORTS.map(([airport, city]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Airports of India',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'airports'],
    question_text: `The ${airport} International Airport is located in which city?`,
    correct: city,
    distractors: shuffle(rng, AIRPORTS.filter(x => x[1] !== city).map(x => x[1])).slice(0, 4),
    explanation: `The ${airport} International Airport is located in ${city}.`
  }));
}

function genRailways(rng) {
  return RAILWAY_ZONES.map(([zone, hq]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Indian Railways Zones',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'railways'],
    question_text: `The headquarters of the ${zone} Railway zone is located at?`,
    correct: hq,
    distractors: shuffle(rng, RAILWAY_ZONES.filter(x => x[1] !== hq).map(x => x[1])).slice(0, 4),
    explanation: `The headquarters of the ${zone} Railway zone is at ${hq}.`
  }));
}

function genCurrencyNotes(rng) {
  return CURRENCY_NOTES.map(([note, feature]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Currency Notes of India',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'currency'],
    question_text: `Which denomination of the Indian currency note features ${feature}?`,
    correct: note,
    distractors: shuffle(rng, CURRENCY_NOTES.filter(x => x[0] !== note).map(x => x[0])).slice(0, 4),
    explanation: `The ${note} note features ${feature}.`
  }));
}

function genOlympicHeroes(rng) {
  return OLYMPIC_HEROES.map(([name, desc]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Indian Sports & Olympics',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'olympics'],
    question_text: `Which Indian sportsperson ${desc}?`,
    correct: name,
    distractors: shuffle(rng, OLYMPIC_HEROES.filter(x => x[0] !== name).map(x => x[0])).slice(0, 4),
    explanation: `${name} ${desc}.`
  }));
}

function genCurrencyReverse(rng) {
  const counts = {};
  for (const c of COUNTRIES) counts[c[2]] = (counts[c[2]] || 0) + 1;
  const unique = COUNTRIES.filter(c => counts[c[2]] === 1);
  return unique.map(([country, capital, cur]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Currencies',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'currency'],
    question_text: `Which country uses the ${cur} as its currency?`,
    correct: country,
    distractors: shuffle(rng, unique.filter(c => c[0] !== country).map(c => c[0])).slice(0, 4),
    explanation: `The ${cur} is the currency of ${country}.`
  }));
}

function genDayReverse(rng) {
  return DAYS.map(([date, name]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Important Days',
    difficulty: 'easy', exam_stage: MAINS, tags: ['ga', 'static', 'days'],
    question_text: `Which important day falls on ${date}?`,
    correct: name,
    distractors: shuffle(rng, DAYS.filter(d => d[0] !== date).map(d => d[1])).slice(0, 4),
    explanation: `${name} is observed on ${date}.`
  }));
}

function genBookReverse(rng) {
  const counts = {};
  for (const b of BOOKS) counts[b[1]] = (counts[b[1]] || 0) + 1;
  const unique = BOOKS.filter(b => counts[b[1]] === 1);
  return unique.map(([book, author]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Books & Authors',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'books'],
    question_text: `Which book was written by ${author}?`,
    correct: book,
    distractors: shuffle(rng, unique.filter(b => b[0] !== book).map(b => b[0])).slice(0, 4),
    explanation: `"${book}" was written by ${author}.`
  }));
}

function genAbbrReverse(rng) {
  return GA_ABBR.map(([abbr, full]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Abbreviations',
    difficulty: 'medium', exam_stage: MAINS, tags: ['ga', 'static', 'abbr'],
    question_text: `Which abbreviation stands for "${full}"?`,
    correct: abbr,
    distractors: shuffle(rng, GA_ABBR.filter(a => a[0] !== abbr).map(a => a[0])).slice(0, 4),
    explanation: `${abbr} stands for ${full}.`
  }));
}

function genDamsStateReverse(rng) {
  return DAMS.map(([dam, river, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'Dams & Rivers',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'dams'],
    question_text: `In which state is the ${dam} dam located?`,
    correct: state,
    distractors: shuffle(rng, DAMS.filter(d => d[0] !== dam).map(d => d[2])).slice(0, 4),
    explanation: `The ${dam} dam is located in ${state}.`
  }));
}

function genHighCourtReverse(rng) {
  return HIGH_COURTS.map(([city, state]) => buildQ(rng, {
    subject: 'General Awareness', topic: 'Static GK', subtopic: 'High Courts of India',
    difficulty: 'hard', exam_stage: MAINS, tags: ['ga', 'static', 'courts'],
    question_text: `The High Court located at ${city} is the High Court of which state?`,
    correct: state,
    distractors: shuffle(rng, HIGH_COURTS.filter(x => x[1] !== state).map(x => x[1])).slice(0, 4),
    explanation: `The High Court at ${city} is the High Court of ${state}.`
  }));
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
const ALL = [
  genCapitals, genCountryFromCapital, genCurrencies, genStateCapitals, genDays,
  genBankingTerms, genBankFacts, genSchemes, genBooks, genEconomy,
  genFirsts, genSports, genAbbr, genConst, genDams,
  genRecords, genNationalParks, genDances, genIntlOrgs, genAwards,
  genRiversIndia, genMonuments, genPeaks,
  genLanguages, genUTCapitals, genSymbols, genPresidents, genPrimeMinisters,
  genNobelIndians, genTemples, genPorts, genHighCourts, genNuclearPlants,
  genRefineries, genLakes, genPasses, genTribes, genFestivals,
  genFolkDances, genBiosphere, genSpace, genDefence, genAirports,
  genRailways, genCurrencyNotes, genOlympicHeroes,
  genCurrencyReverse, genDayReverse, genBookReverse, genAbbrReverse,
  genDamsStateReverse, genHighCourtReverse
];

function generate(args) {
  const count = args.count || 600;
  const seed = args.seed || 20260804;
  const rng = mulberry32(seed);
  const existing = loadExistingTexts('General Awareness');
  const seen = new Set();
  const rows = [];
  const stats = {};

  const batches = ALL.map(fn => {
    const items = fn(rng);
    return Array.isArray(items) ? items : [items];
  });

  const maxLen = Math.max(...batches.map(b => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const batch of batches) {
      if (i >= batch.length) continue;
      const item = batch[i];
      const base = normText(item.question_text);
      if (existing.has(base)) continue;
      const norm = `${base} | ${[item.option_a, item.option_b, item.option_c, item.option_d].map(o => normText(o)).join('|')}`;
      if (seen.has(norm)) continue;
      seen.add(norm);
      rows.push(item);
      stats[`${item.topic}/${item.subtopic}`] = (stats[`${item.topic}/${item.subtopic}`] || 0) + 1;
      if (rows.length >= count) break;
    }
    if (rows.length >= count) break;
  }

  const summary = { requested: count, generated: rows.length, by_topic: stats, skipped_existing: existing.size };
  console.log(`Generated ${rows.length} General Awareness questions (seed ${seed}, skipped ${existing.size} existing texts)`);
  return { rows, summary };
}

module.exports = { generate, buildQ };

if (require.main === module) {
  const args = {
    count: parseInt(argValue('count', '600'), 10) || 600,
    seed: parseInt(argValue('seed', '20260804'), 10) || 20260804
  };
  const { rows, summary } = generate(args);
  verify(rows);
  emit(rows, summary, 'ga');
}
