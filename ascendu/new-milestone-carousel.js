// NEW CAROUSEL-BASED MILESTONE PATH COMPONENT
// Replace the existing MilestonePath function (lines 10637-10757) with this

function MilestonePath({ history }) {
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
                    {unlocked ? "✓ Completed" : `${Math.max(0, stage.max - totalHours).toFixed(1)}h remaining`}
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
            aria-label={`Go to stage ${i + 1}`}
          />
        ))}
      </div>
      
      <div aria-hidden="true" style={mp.dividerOpen}/>
    </section>
  );
}

// NEW STYLES TO ADD TO mp OBJECT (add these after line 10634, before closing });)
// Add these properties to the existing mp object:

/*
  carouselContainer: { 
    position: "relative", 
    display: "flex", 
    alignItems: "center", 
    gap: 8, 
    padding: "16px 0",
    overflow: "hidden"
  },
  carouselTrack: { 
    display: "flex", 
    alignItems: "stretch", 
    gap: 12, 
    flex: 1,
    minHeight: 280
  },
  stageCard: { 
    flex: "0 0 auto", 
    display: "flex", 
    flexDirection: "column", 
    alignItems: "center", 
    justifyContent: "space-between",
    background: "#fff", 
    border: "1px solid #E1E8DF", 
    borderRadius: 16, 
    padding: "16px 14px",
    transition: "all 0.3s ease",
    minHeight: "100%"
  },
  stageCardSide: { 
    width: 90, 
    opacity: 0.5, 
    transform: "scale(0.85)"
  },
  stageCardCenter: { 
    width: 180, 
    opacity: 1, 
    transform: "scale(1)",
    boxShadow: "0 4px 12px rgba(30,55,37,.12)"
  },
  stageCardCurrent: { 
    borderColor: "#56A77A",
    borderWidth: 2,
    background: "linear-gradient(135deg, #F0F8F3, #fff)"
  },
  stageImageWrap: { 
    width: "100%", 
    aspectRatio: "1", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 12
  },
  stageImage: { 
    width: "100%", 
    height: "100%", 
    objectFit: "contain", 
    borderRadius: 12
  },
  stageInfo: { 
    textAlign: "center", 
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4
  },
  stageName: { 
    fontSize: 13, 
    fontWeight: 800, 
    lineHeight: 1.25,
    minHeight: 32
  },
  stageNameUnlocked: { 
    color: "#163A25"
  },
  stageNameLocked: { 
    color: "#39423B"
  },
  stageRange: { 
    fontSize: 10.5, 
    fontWeight: 650,
    marginTop: 2
  },
  stageRangeUnlocked: { 
    color: "#2E5A40"
  },
  stageRangeLocked: { 
    color: "#59625B"
  },
  stageStatus: { 
    fontSize: 10.5, 
    fontWeight: 800,
    marginTop: 4
  },
  stageStatusUnlocked: { 
    color: "#1F6B3A"
  },
  stageStatusLocked: { 
    color: "#A35D1F"
  },
  stageDotWrap: { 
    display: "flex", 
    justifyContent: "center", 
    marginTop: 12
  },
  stageDot: { 
    width: 12, 
    height: 12, 
    borderRadius: "50%",
    transition: "all 0.25s ease"
  },
  stageDotUnlocked: { 
    background: `radial-gradient(circle at 35% 30%, #63D68C, ${MILESTONE_GREEN} 62%)`,
    boxShadow: "0 0 6px rgba(55,165,91,.7)"
  },
  stageDotLocked: { 
    background: MILESTONE_GREY,
    opacity: 0.82
  },
  navBtn: { 
    border: "none", 
    background: "#E8F5EE", 
    color: "#2D6A4F",
    width: 36,
    height: 36,
    borderRadius: "50%",
    fontSize: 24,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    flexShrink: 0
  },
  navBtnLeft: {},
  navBtnRight: {},
  indicatorDots: { 
    display: "flex", 
    gap: 6, 
    justifyContent: "center", 
    marginTop: 12,
    padding: "0 4px"
  },
  indicatorDot: { 
    width: 8, 
    height: 8, 
    borderRadius: "50%",
    border: "none",
    background: "#D0D8D1",
    cursor: "pointer",
    padding: 0,
    transition: "all 0.2s ease"
  },
  indicatorDotActive: { 
    width: 24,
    borderRadius: 4,
    background: "#2D6A4F"
  },
  indicatorDotCurrent: { 
    background: "#56A77A",
    boxShadow: "0 0 0 2px #E8F5EE"
  },
*/
