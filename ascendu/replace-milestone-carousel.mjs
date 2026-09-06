import { readFileSync, writeFileSync } from "fs";

const filePath = "ascendu/ascendu/src/App.jsx";
const content = readFileSync(filePath, "utf8");

// Find the MilestonePath function
const startMarker = "function MilestonePath({ history }) {";
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.error("ERROR: Could not find MilestonePath function start");
  process.exit(1);
}

// Find the end of the function - it's the closing "}" before "// ── Main App ──"
const mainAppMarker = "// ── Main App ──";
const mainAppIdx = content.indexOf(mainAppMarker, startIdx);
if (mainAppIdx === -1) {
  console.error("ERROR: Could not find Main App marker");
  process.exit(1);
}

// The function ends with "}\n\n" right before the Main App comment
// Find the last "}" before mainAppIdx
const endIdx = content.lastIndexOf("}", mainAppIdx);
if (endIdx === -1 || endIdx < startIdx) {
  console.error("ERROR: Could not find function end");
  process.exit(1);
}

const newFunction = `function MilestonePath({ history }) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  const totalHours = Array.isArray(history)
    ? history.reduce((a,s)=>a+(Number(s.secs)||0),0)/3600
    : 0;
  
  const stageCount = MILESTONE_STAGES.length;
  
  // Determine current stage based on totalHours
  const currentStageIndex = MILESTONE_STAGES.findIndex((stage, i) => {
    return totalHours >= stage.min && totalHours < stage.max;
  });
  
  // If user has maxed out all stages, show last stage
  const userCurrentStage = currentStageIndex === -1 
    ? stageCount - 1 
    : currentStageIndex;
  
  // Initialize carousel to user's current stage
  useEffect(() => {
    setCarouselIndex(userCurrentStage);
  }, [userCurrentStage]);
  
  // Get the 3 visible stages (prev, current, next)
  const getVisibleStages = () => {
    const stages = [];
    for (let offset = -1; offset <= 1; offset++) {
      const index = carouselIndex + offset;
      if (index >= 0 && index < stageCount) {
        stages.push({
          ...MILESTONE_STAGES[index],
          index,
          position: offset // -1 = left, 0 = center, 1 = right
        });
      }
    }
    return stages;
  };
  
  const visibleStages = getVisibleStages();
  
  const goToPrev = () => {
    if (carouselIndex > 0) {
      setCarouselIndex(carouselIndex - 1);
    }
  };
  
  const goToNext = () => {
    if (carouselIndex < stageCount - 1) {
      setCarouselIndex(carouselIndex + 1);
    }
  };

  // Touch handling for swipe
  const minSwipeDistance = 50;
  
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
  };
  
  return (
    <section style={mp.cardOpen} aria-label="Progress level">
      <div style={mp.header}>
        <span style={mp.title}>Progress Level</span>
        <span style={mp.hours}>⏳ {fmtHrs(totalHours*3600)} lifetime</span>
      </div>
      
      <div style={mp.carouselContainer}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        
        {/* Navigation Buttons */}
        <button
          type="button"
          style={{...mp.navBtn, ...mp.navBtnLeft, opacity: carouselIndex === 0 ? 0.3 : 1}}
          onClick={goToPrev}
          disabled={carouselIndex === 0}
          aria-label="Previous stage">
          ‹
        </button>
        
        {/* Carousel Track */}
        <div style={mp.carouselTrack}>
          {visibleStages.map((stage) => {
            const unlocked = totalHours >= stage.max;
            const isCurrent = stage.index === userCurrentStage;
            const isCenter = stage.position === 0;
            
            return (
              <div
                key={stage.index}
                style={{
                  ...mp.stageCard,
                  ...(isCenter ? mp.stageCardCenter : mp.stageCardSide),
                  ...(isCurrent ? mp.stageCardCurrent : {})
                }}>
                
                {/* Stage Image */}
                {stage.image && (
                  <div style={mp.stageImageWrap}>
                    <img 
                      src={stage.image} 
                      alt={stage.name}
                      style={mp.stageImage}
                      loading="lazy" />
                  </div>
                )}
                
                {/* Stage Info */}
                <div style={mp.stageInfo}>
                  <div style={{...mp.stageName, ...(unlocked ? mp.stageNameUnlocked : mp.stageNameLocked)}}>
                    {stage.name}
                  </div>
                  <div style={{...mp.stageRange, ...(unlocked ? mp.stageRangeUnlocked : mp.stageRangeLocked)}}>
                    {stage.min}–{stage.max} hours
                  </div>
                  <div style={{...mp.stageStatus, ...(unlocked ? mp.stageStatusUnlocked : mp.stageStatusLocked)}}>
                    {unlocked ? "✓ Completed" : \`\${Math.max(0, stage.max - totalHours).toFixed(1)}h remaining\`}
                  </div>
                </div>
                
                {/* Progress Indicator Dot */}
                <div style={mp.stageDotWrap}>
                  <div style={{
                    ...mp.stageDot,
                    ...(unlocked ? mp.stageDotUnlocked : mp.stageDotLocked)
                  }} />
                </div>
              </div>
            );
          })}
        </div>
        
        <button
          type="button"
          style={{...mp.navBtn, ...mp.navBtnRight, opacity: carouselIndex === stageCount - 1 ? 0.3 : 1}}
          onClick={goToNext}
          disabled={carouselIndex === stageCount - 1}
          aria-label="Next stage">
          ›
        </button>
      </div>
      
      {/* Stage Indicator Dots */}
      <div style={mp.indicatorDots}>
        {MILESTONE_STAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            style={{
              ...mp.indicatorDot,
              ...(i === carouselIndex ? mp.indicatorDotActive : {}),
              ...(i === userCurrentStage ? mp.indicatorDotCurrent : {})
            }}
            onClick={() => setCarouselIndex(i)}
            aria-label={\`Go to stage \${i + 1}\`}
          />
        ))}
      </div>
      
      <div aria-hidden="true" style={mp.dividerOpen}/>
    </section>
  );
}`;

const newContent = content.slice(0, startIdx) + newFunction + content.slice(endIdx + 1);

writeFileSync(filePath, newContent, "utf8");
console.log("SUCCESS: MilestonePath function replaced with carousel version");
console.log(`Replaced ${endIdx - startIdx + 1} characters with ${newFunction.length} characters`);