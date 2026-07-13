function parseNodeVersion(version = process.versions.node) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : null;
}

function assertNodeVersion(minMajor = 22, minMinor = 5) {
  const actual = parseNodeVersion();
  if (!actual || actual.major < minMajor || (actual.major === minMajor && actual.minor < minMinor)) {
    console.error(`[Runtime] Node.js ${minMajor}.${minMinor}+ is required; found ${process.versions.node}`);
    process.exitCode = 2;
    return false;
  }
  return true;
}

module.exports = { parseNodeVersion, assertNodeVersion };
