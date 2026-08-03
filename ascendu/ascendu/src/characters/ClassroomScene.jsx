import { memo, useMemo } from "react";
import CharacterRenderer from "./CharacterRenderer.jsx";
import { characterStageFromEnhancement } from "./characterStages.js";
import { normalizeCharacterBase, normalizeCharacterStyle } from "./characterDefinitions.js";
import "./classroomScene.css";

export const CLASSROOM_SEATS = Object.freeze([
  { x: 50, y: 45, scale: 1.02, depth: "front", facing: "three-quarter", deskVariant: "default" },
  { x: 23, y: 49, scale: .92, depth: "front", facing: "three-quarter", deskVariant: "mint" },
  { x: 77, y: 49, scale: .92, depth: "front", facing: "side", deskVariant: "coral" },
  { x: 34, y: 29, scale: .77, depth: "middle", facing: "three-quarter", deskVariant: "default" },
  { x: 66, y: 29, scale: .77, depth: "middle", facing: "side", deskVariant: "mint" },
  { x: 13, y: 30, scale: .7, depth: "middle", facing: "three-quarter", deskVariant: "default" },
  { x: 87, y: 30, scale: .7, depth: "middle", facing: "side", deskVariant: "coral" },
  { x: 24, y: 12, scale: .58, depth: "back", facing: "three-quarter", deskVariant: "default" },
  { x: 50, y: 11, scale: .58, depth: "back", facing: "side", deskVariant: "mint" },
  { x: 76, y: 12, scale: .58, depth: "back", facing: "three-quarter", deskVariant: "default" },
]);

export const CLASSROOM_PRESETS = Object.freeze([
  { id:"rows", label:"Calm rows" },
  { id:"collaborative", label:"Study circles" },
  { id:"window", label:"Window focus" },
  { id:"presentation", label:"Board session" },
]);

function seatForPreset(seat, index, preset) {
  if (preset === "collaborative") return { ...seat, x: index===0?50:index%2?28:72, y: seat.y+(index>2?4:0), facing:index%2?"three-quarter":"side" };
  if (preset === "window") return { ...seat, x: Math.max(14,seat.x-8), y:seat.y+(index%3)*1.5 };
  if (preset === "presentation") return { ...seat, x: 18+(index%4)*21.5, y: 48-Math.floor(index/4)*18, facing:"three-quarter" };
  return seat;
}

function stableNumber(value) {
  return String(value || "").split("").reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 17);
}

function ClassroomSceneComponent({
  sessions=[], subjects=[], enhancements={}, characterBase="female", characterStyle={},
  activeSkin="default", label="Your classroom", range="week", layout={}, onArrange,
}) {
  const students = useMemo(() => {
    const safeSessions = Array.isArray(sessions) ? sessions.filter(Boolean) : [];
    const source = safeSessions.length ? safeSessions.slice(-CLASSROOM_SEATS.length).reverse() : [{ id:"current", skin:activeSkin, subject:"default", secs:0 }];
    return source.map((session, index) => {
      const skin = typeof session.skin === "string" ? session.skin : activeSkin;
      const subject = subjects.find(item => item.id === session.subject);
      const seed = stableNumber(session.id || session.ts || `${session.subject}-${index}`);
      const owner = index === 0;
      return {
        id: session.id || `${session.ts || "session"}-${index}`,
        owner,
        base: owner ? normalizeCharacterBase(characterBase) : (seed % 2 ? "male" : "female"),
        style: normalizeCharacterStyle(characterStyle, skin),
        skin,
        stage: characterStageFromEnhancement(enhancements?.[skin]),
        subject,
        activity: index % 4 === 2 ? "idle" : "study",
      };
    });
  }, [sessions, subjects, enhancements, characterBase, characterStyle, activeSkin]);

  return <section className="lc-classroom" aria-label={label}>
    <div className="lc-room-shell">
      <div className="lc-room-ceiling"><span/><span/><span/></div>
      <div className="lc-window" aria-hidden="true"><i/><i/><b/></div>
      <div className="lc-board" aria-hidden="true"><strong>Grow through learning</strong><span>small steps • steady focus • shared progress</span></div>
      <div className="lc-shelf" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
      <div className="lc-clock" aria-hidden="true"/>
      <div className="lc-floor" aria-hidden="true"/>
      <div className="lc-class-title"><span>CLASSROOM</span><strong>{students.length} {students.length===1?"learner":"learning moments"}</strong></div>
      <div className="lc-students">
        {students.map((student, index) => {
          const seat = seatForPreset(CLASSROOM_SEATS[index],index,layout?.classroomPreset||"rows");
          return <div key={student.id} className={`lc-seat lc-seat-${seat.depth} ${student.owner?"is-current":""}`} style={{left:`${seat.x}%`,top:`${seat.y}%`,zIndex:seat.depth==="front"?30:seat.depth==="middle"?20:10,"--seat-scale":seat.scale,"--seat-delay":`${-(index*1.31)%5}s`}}>
            <CharacterRenderer base={student.base} characterStyle={{...student.style,deskTheme:seat.deskVariant}} legacySkin={student.skin} stage={student.stage} view="seated" activity={student.activity} motion={student.owner?"full":"quiet"} detail={seat.depth==="back"?"simple":"full"} size={118} decorative={!student.owner} title={student.owner?`Your ${student.subject?.label || "study"} character`:undefined}/>
            {student.owner&&<span className="lc-you-label">You</span>}
          </div>;
        })}
      </div>
      <div className="lc-room-glow" aria-hidden="true"/>
    </div>
    <div className="lc-classroom-caption"><span>{range === "week" ? "This week" : range === "month" ? "This month" : "Your learning year"} in the classroom</span>{onArrange&&<button type="button" onClick={onArrange}>Arrange seats</button>}</div>
  </section>;
}

export const ClassroomScene = memo(ClassroomSceneComponent);
export default ClassroomScene;
