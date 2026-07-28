import { memo, useMemo } from "react";

const PEER_LIMIT = 5;

function peerColor(name = "") {
  let hash = 17;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return ["#6D5DF6", "#E07B54", "#56B68B", "#C57BDB", "#5B8DEF", "#D7A13D"][hash % 6];
}

const Classmate = memo(function Classmate({ peer, seat }) {
  const name = String(peer?.username || peer?.name || "Classmate");
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div className={`lm-classmate lm-classmate-${seat}`} title={name} style={{ "--lm-peer": peerColor(name) }}>
      <span className="lm-classmate-status" aria-hidden="true"/>
      <div className="lm-classmate-head">{initial}</div>
      <div className="lm-classmate-body"/>
      <div className="lm-classmate-desk">
        <span>{peer?.subjEmoji || "✎"}</span>
      </div>
      <span className="lm-classmate-name">{name}</span>
    </div>
  );
});

export default function ClassroomScene({ children, peers = [], currentUser = "", stage = 0, weather = "clear", focusing = false }) {
  const visiblePeers = useMemo(
    () => peers.filter(peer => String(peer?.username || peer?.name || "") !== currentUser).slice(0, PEER_LIMIT),
    [peers, currentUser],
  );
  const emptySeats = Math.max(0, 3 - visiblePeers.length);

  return (
    <div className={`lm-classroom${focusing ? " is-focusing" : ""}`} data-stage={stage}>
      <div className={`lm-classroom-window weather-${weather}`} aria-hidden="true">
        <span className="lm-classroom-sky-orb"/>
        <span className="lm-classroom-cloud cloud-one"/>
        <span className="lm-classroom-cloud cloud-two"/>
      </div>
      <div className="lm-classroom-board" aria-hidden="true">
        <strong>One thing at a time</strong>
        <span>focus · learn · grow</span>
      </div>
      <div className="lm-classroom-shelf" aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="lm-classroom-floor" aria-hidden="true"/>

      {visiblePeers.map((peer, index) => <Classmate key={peer.username || peer.name || index} peer={peer} seat={index + 1}/>)}
      {Array.from({ length: emptySeats }, (_, index) => (
        <div className={`lm-classmate lm-classmate-empty lm-classmate-${visiblePeers.length + index + 1}`} key={`empty-${index}`} aria-hidden="true">
          <div className="lm-classmate-head"/>
          <div className="lm-classmate-body"/>
          <div className="lm-classmate-desk"><span>·</span></div>
        </div>
      ))}

      <div className="lm-classroom-hero">
        <div className="lm-classroom-hero-glow" aria-hidden="true"/>
        {children}
        <div className="lm-classroom-hero-desk" aria-hidden="true"><span>My focus space</span></div>
      </div>
      <div className="lm-classroom-motes" aria-hidden="true"><i/><i/><i/></div>
    </div>
  );
}
