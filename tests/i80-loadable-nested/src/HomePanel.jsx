import React from "react";

export default function HomePanel(props) {
  return <h1>{props.label} {props.activeRoute.getDisplayName()}</h1>;
}
