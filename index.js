const os = require('os')
const path = require('path')
const semver = require('semver')
const get = require('simple-get').concat
const actions = require('@actions/core')
const cache = require('@actions/tool-cache')

function getJSON (opts) {
  return new Promise((resolve, reject) => {
    get({ ...opts, json: true }, (err, req, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

async function downloadZig (version) {
  const host = {
    linux: 'x86_64-linux',
    darwin: 'x86_64-macos',
    win32: 'x86_64-windows'
  }[os.platform()] || os.platform()
  const ext = {
    linux: 'tar.xz',
    darwin: 'tar.xz',
    win32: 'zip'
  }[os.platform()]

  const index = await getJSON({ url: 'https://ziglang.org/download/index.json' })

  const availableVersions = Object.keys(index).filter((v) => semver.valid(v))
  const useVersion = semver.maxSatisfying(availableVersions, version)

  const meta = index[version || useVersion];
  if (!meta || !meta[host]) {
    throw new Error(`Could not find version ${version} for platform ${host}`)
  }

  const hostVariantName = {
    linux: 'linux-x86_64',
    darwin: 'macos-x86_64',
    win32: 'windows-x86_64'
  }[os.platform()]
  const variantName = `zig-${hostVariantName}-${version}`
  const downloadPath = await cache.downloadTool(meta[host].tarball)
  const zigPath = ext === 'zip'
    ? await cache.extractZip(downloadPath)
    : await cache.extractTar(downloadPath, undefined, 'x')

  const binPath = path.join(zigPath, variantName)
  return cache.cacheDir(binPath, 'zig', version)
}

async function main () {
  const version = actions.getInput('version') || '0.5.0'
  if (semver.lt(version, '0.3.0')) {
    actions.setFailed('This action does not work with Zig 0.1.0 and Zig 0.2.0')
    return
  }

  let zigPath = cache.find('zig', version)
  if (!zigPath) {
    zigPath = await downloadZig(version)
  }

  // Add the `zig` binary to the $PATH
  actions.addPath(zigPath)
}

main()
