(function(){
"use strict";
var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
/* review #11: RM is not a once-read — a change applies without reload */
if(window.matchMedia){var rmMQ=matchMedia("(prefers-reduced-motion: reduce)");var rmSync=function(e){RM=e.matches};(rmMQ.addEventListener||rmMQ.addListener).call(rmMQ,"change",rmSync)}
