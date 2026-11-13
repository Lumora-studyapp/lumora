export const CHARACTER_PROGRESSION_STAGES = {
  "lumora-scholar-man":["First Day","Finding Focus","Researcher","Thesis Complete","Lumora Graduate"],
  "lumora-scholar-woman":["First Day","Finding Focus","Researcher","Thesis Complete","Lumora Graduate"],
  "cristiano-ronaldo":["Madeira Football Child","Madeira Broom Teen","Real Madrid Champion","Ballon d'Or Winner","Portugal Euros Champion"],
  "einstein":["Compass-Curious Child","Aarau Light-Beam Student","Bern Patent Clerk","Relativity Physicist","Scientific Genius"],
  "davinci":["Vinci Nature Sketcher","Florentine Workshop Apprentice","Anatomy Notebook Scholar","Flying Machine Visionary","Renaissance Master"],
  "edison":["Basement Laboratory Boy","Railway Newsboy Inventor","Telegraph Operator","Menlo Park Inventor","Electric Light Pioneer"],
  "gallileo":["Pisa Sky-Watcher","Mathematics Student","Motion Experimenter","Starry Messenger Astronomer","Heliocentric Visionary"],
  "lebron-james":["Akron Kid","High School Player","Cleveland Champion","Scoring King","Legacy"],
  "lionel-messi":["Grandoli Child","Academy Teen","Barcelona Peak","Club Champion","World Cup Champion"],
  "michael-jackson":["Child Singer","Disco Performer","Red Jacket Era","Moonwalk Peak","King of Pop Legacy"],
  "tiger-woods":["Child Golfer","Junior Champion","Red Shirt Breakthrough","Masters Champion","Comeback Legend"],
  "william-shakespeare":["Stratford Child","Quill Poet","Globe Playwright","The Bard","First Folio Legacy"],
  "marie-curie":["Polish Schoolgirl","Paris Science Student","Laboratory Researcher","Radium Pioneer","Two Nobel Icon"],
  "pythagoras":["Counting Stones","Number Patterns","Triangle Solver","Theorem Demonstration","Greek Sage Legacy"],
  "jk-rowling":["Young Story Creator","Student Writer","Cafe Manuscript Writer","Published Fantasy Author","Seven Book Legacy"],
  "ludwig-van-beethoven":["Child Pianist","Vienna Student","Concert Pianist","Symphony Composer","Deaf Maestro Legacy"],
  "neil-armstrong":["Model Plane Dreamer","X-15 Test Pilot","Gemini Astronaut","Apollo 11 Commander","Moonwalk Legacy"],
  "henry-ford":["Watch Tinkerer","Engine Builder","Quadricycle Engineer","Model T Innovator","Automobile Mastermind"],
  "michelangelo":["Marble Apprentice","Medici Sculptor","Sculpture Master","Sistine Visionary","Dome Architect Legacy"],
  "christopher-columbus":["Mediterranean Sailor","Chart Navigator","Captain with Instruments","1492 Expedition","Four Voyage Navigator"],
  "elon-musk":["Computer Dreamer","Zip2 Startup Worker","Online Payments Founder","Electric Car and Rocket CEO","Mars Technology Figure"],
  "bill-gates":["Lakeside Computer Student","Programming Hustler","PC Software Cofounder","Graphical Computing CEO","Computing and Philanthropy Legacy"],
};

export const TREE_SKINS = [
  // Internal fallback for legacy sessions. It is intentionally not displayed
  // or purchasable in the Skins page.
  { id:"default", name:"Oak", cost:0, shape:"round", trunk:"#8B6340", canopy:null, desc:"", collection:"legacy", hidden:true },
  { id:"lumora-scholar-man", name:"Lumora Scholar Man", cost:0, shape:"round", trunk:"#63317D", canopy:"#8E4CB0", desc:"Free Lumora student · grow into a graduate", collection:"characters", characterImage:"/Images/Lumora Scholar Man (5) - Lumora Graduate.png", progressionStages:CHARACTER_PROGRESSION_STAGES["lumora-scholar-man"], finalEvolution:true, alwaysShowCharacter:true },
  { id:"lumora-scholar-woman", name:"Lumora Scholar Woman", cost:0, shape:"round", trunk:"#63317D", canopy:"#8E4CB0", desc:"Free Lumora student · grow into a graduate", collection:"characters", characterImage:"/Images/Lumora Scholar Woman (5) - Lumora Graduate.png", progressionStages:CHARACTER_PROGRESSION_STAGES["lumora-scholar-woman"], finalEvolution:true, alwaysShowCharacter:true },
  { id:"einstein", name:"Albert Einstein", cost:1600, shape:"round", trunk:"#6B4A36", canopy:"#B98253", desc:"The Genius · relativity icon", collection:"characters", characterImage:"/Images/Albert Einstein (5) - Scientific Genius.png", progressionStages:CHARACTER_PROGRESSION_STAGES.einstein, finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"gallileo", name:"Galileo Galilei", cost:1700, shape:"round", trunk:"#5F402A", canopy:"#A97A40", desc:"The Visionary · observational astronomy", collection:"characters", characterImage:"/Images/Galileo Galilei (5) - Heliocentric Visionary.png", characterImageScale:1.1, progressionStages:CHARACTER_PROGRESSION_STAGES.gallileo, finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"davinci", name:"Leonardo da Vinci", cost:1800, shape:"round", trunk:"#6C5137", canopy:"#9A6A32", desc:"The Renaissance Master · art and invention", collection:"characters", characterImage:"/Images/Leonardo da Vinci (5) - Renaissance Master.png", progressionStages:CHARACTER_PROGRESSION_STAGES.davinci, finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"edison", name:"Thomas Alva Edison", cost:1900, shape:"round", trunk:"#454545", canopy:"#D6A83C", desc:"The Bright Spark · electric light pioneer", collection:"characters", characterImage:"/Images/Thomas Alva Edison (5) - Electric Light Pioneer.png", progressionStages:CHARACTER_PROGRESSION_STAGES.edison, finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  // Life-stage character collection. Cards showcase the fifth-stage artwork;
  // Focus sessions move through stages one to five minute by minute.
  { id:"lebron-james", name:"LeBron James", cost:2500, shape:"round", trunk:"#5A3624", canopy:"#7E2D2D", desc:"Final evolution · basketball legacy", collection:"characters", characterImage:"/Images/LeBron James (5) - Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["lebron-james"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"lionel-messi", name:"Lionel Messi", cost:2500, shape:"round", trunk:"#35567F", canopy:"#71BCEB", desc:"Final evolution · World Cup champion", collection:"characters", characterImage:"/Images/Lionel Messi (5) - World Cup Champion.png", progressionStages:CHARACTER_PROGRESSION_STAGES["lionel-messi"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"michael-jackson", name:"Michael Jackson", cost:2500, shape:"round", trunk:"#36263C", canopy:"#D74A50", desc:"Final evolution · King of Pop legacy", collection:"characters", characterImage:"/Images/Michael Jackson (5) - King of Pop Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["michael-jackson"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"tiger-woods", name:"Tiger Woods", cost:2400, shape:"round", trunk:"#315235", canopy:"#84B45E", desc:"Final evolution · comeback legend", collection:"characters", characterImage:"/Images/Tiger Woods (5) - Comeback Legend.png", progressionStages:CHARACTER_PROGRESSION_STAGES["tiger-woods"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"william-shakespeare", name:"William Shakespeare", cost:2200, shape:"round", trunk:"#523C2C", canopy:"#A07B54", desc:"Final evolution · First Folio legacy", collection:"characters", characterImage:"/Images/William Shakespeare (5) - First Folio Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["william-shakespeare"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"marie-curie", name:"Marie Curie", cost:2300, shape:"round", trunk:"#3D5360", canopy:"#85B9A8", desc:"Final evolution · two Nobel icon", collection:"characters", characterImage:"/Images/Marie Curie (5) - Two Nobel Icon.png", progressionStages:CHARACTER_PROGRESSION_STAGES["marie-curie"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"pythagoras", name:"Pythagoras", cost:2100, shape:"round", trunk:"#6A4C32", canopy:"#C7A15C", desc:"Final evolution · Greek sage", collection:"characters", characterImage:"/Images/Pythagoras (5) - Greek Sage Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["pythagoras"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"jk-rowling", name:"J. K. Rowling", cost:2200, shape:"round", trunk:"#4A355F", canopy:"#9F83C7", desc:"Final evolution · seven-book legacy", collection:"characters", characterImage:"/Images/J. K. Rowling (5) - Seven Book Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["jk-rowling"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"ludwig-van-beethoven", name:"Ludwig van Beethoven", cost:2300, shape:"round", trunk:"#473C34", canopy:"#A8927C", desc:"Final evolution · deaf maestro legacy", collection:"characters", characterImage:"/Images/Ludwig van Beethoven (5) - Deaf Maestro Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["ludwig-van-beethoven"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"neil-armstrong", name:"Neil Armstrong", cost:2400, shape:"round", trunk:"#31445D", canopy:"#91B7D9", desc:"Final evolution · moonwalk legacy", collection:"characters", characterImage:"/Images/Neil Armstrong (5) - Moonwalk Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["neil-armstrong"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"henry-ford", name:"Henry Ford", cost:2200, shape:"round", trunk:"#4D4239", canopy:"#8F8A76", desc:"Final evolution · automobile mastermind", collection:"characters", characterImage:"/Images/Henry Ford (5) - Automobile Mastermind.png", progressionStages:CHARACTER_PROGRESSION_STAGES["henry-ford"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"michelangelo", name:"Michelangelo", cost:2300, shape:"round", trunk:"#6D5642", canopy:"#B99B7B", desc:"Final evolution · dome architect legacy", collection:"characters", characterImage:"/Images/Michelangelo (5) - Dome Architect Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["michelangelo"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"christopher-columbus", name:"Christopher Columbus", cost:2200, shape:"round", trunk:"#3D5263", canopy:"#7FA9B7", desc:"Final evolution · four-voyage navigator", collection:"characters", characterImage:"/Images/Christopher Columbus (5) - Four Voyage Navigator.png", progressionStages:CHARACTER_PROGRESSION_STAGES["christopher-columbus"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"elon-musk", name:"Elon Musk", cost:2600, shape:"round", trunk:"#343B4A", canopy:"#8F9FB7", desc:"Final evolution · Mars technology figure", collection:"characters", characterImage:"/Images/Elon Musk (5) - Mars Technology Figure.png", progressionStages:CHARACTER_PROGRESSION_STAGES["elon-musk"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"bill-gates", name:"Bill Gates", cost:2500, shape:"round", trunk:"#3F5A45", canopy:"#87AF7A", desc:"Final evolution · computing and philanthropy", collection:"characters", characterImage:"/Images/Bill Gates (5) - Computing and Philanthropy Legacy.png", progressionStages:CHARACTER_PROGRESSION_STAGES["bill-gates"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
  { id:"cristiano-ronaldo", name:"Cristiano Ronaldo", cost:2600, shape:"round", trunk:"#5C292D", canopy:"#B62E36", desc:"The Goalscorer · Portugal football legend", collection:"characters", characterImage:"/Images/Cristiano Ronaldo (5) - Portugal Euros Champion.png", progressionStages:CHARACTER_PROGRESSION_STAGES["cristiano-ronaldo"], finalEvolution:true, alwaysShowCharacter:true, isNew:true },
];

export const getCharacterProgressionImage = (skin, stageIndex=0) => {
  const stageName=skin?.progressionStages?.[stageIndex];
  if(!stageName||skin?.blankProgressions)return null;
  return `/Images/${skin.name} (${stageIndex+1}) - ${stageName}.png`;
};
