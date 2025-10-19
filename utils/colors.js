// utils/colors.js

// Static colors by class type
const CLASS_TYPE_COLORS = {
  lecture: 0x2ECC71, // green
  lab: 0xE67E22,     // orange
  seminar: 0x3498DB, // blue
};

// Simple fallback color generator (in case a new type is added)
function getClassColor(type) {
  if (CLASS_TYPE_COLORS[type]) return CLASS_TYPE_COLORS[type];
  // Generate random but readable color
  return Math.floor(Math.random() * 0xffffff);
}

module.exports = { CLASS_TYPE_COLORS, getClassColor };
