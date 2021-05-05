#!/usr/bin/env node
// Generated by CoffeeScript 2.5.1
// Deps
var Table, addStats, analyzeUrl, chalk, chromeLauncher, clearLines, configs, createProgressBar, defaultProgressTheme, execute, formatRow, formatTime, formatValue, lighthouse, makeTable, program, readline, stats, ucFirst;

({program} = require('@caporal/core'));

lighthouse = require('lighthouse');

chromeLauncher = require('chrome-launcher');

createProgressBar = require('progress-estimator');

defaultProgressTheme = require('progress-estimator/src/theme');

stats = require('stats-lite');

readline = require('readline');

Table = require('cli-table');

chalk = require('chalk');

// Load Lighthouse configs
configs = {
  desktop: require('lighthouse/lighthouse-core/config/lr-desktop-config.js'),
  mobile: require('lighthouse/lighthouse-core/config/lr-mobile-config.js')
};

// On cntrl-c, trigger normal exit behavior
process.on('SIGINT', function() {
  return process.exit(0);
});

// Setup CLI
program.description('Averages multiple successive Lighthouse tests').argument('<url>', 'The comma-delimited URL(s) to test').option('-t, --times <count>', 'The number of tests to run', {
  default: 10
// Map args and begin running
}).option('-d, --desktop', 'Test only desktop').option('-m, --mobile ', 'Test only mobile').option('-b, --block <urls>', 'Comma seperated URLs to block, wildcards allowed').option('-s, --summary', 'Only show summary rows').action(async function({
    args: {url},
    options: {times, desktop, mobile, block, summary}
  }) {
  var blockedUrls, devices, j, len, results1, urls;
  devices = (function() {
    switch (false) {
      case !mobile:
        return ['mobile'];
      case !desktop:
        return ['desktop'];
      default:
        return ['mobile', 'desktop'];
    }
  })();
  blockedUrls = block ? block.split(',') : [];
  // If url contains a space, assume space-separated URLs.  Split into array and
  // test each url.
  urls = url.split(',');
  results1 = [];
  for (j = 0, len = urls.length; j < len; j++) {
    url = urls[j];
    console.log("");
    console.log(chalk.yellow.bold(url));
    results1.push((await execute({url, times, devices, blockedUrls, summary})));
  }
  return results1;
});

// Start cli program
program.run();

// Boot up the runner
execute = async function({url, times, devices, blockedUrls, summary}) {
  var bootChrome, chrome, device, i, j, k, len, len1, progress, results, theme;
  // Create shared progress bar
  theme = defaultProgressTheme;
  theme.asciiInProgress = chalk.hex('#00de6d');
  progress = createProgressBar({theme});
  console.log(""); // Adds a newline
  
  // Create chrome instance that runs test
  bootChrome = chromeLauncher.launch({
    chromeFlags: ['--headless']
  });
  chrome = (await progress(bootChrome, 'Booting Chrome', {
    estimate: 1000
  }));
  process.on('exit', function() {
    return chrome.kill(); // Cleanup
  });
  
  // Loop through each device and run tests
  results = [];
  for (j = 0, len = devices.length; j < len; j++) {
    device = devices[j];
    results.push((await analyzeUrl({url, times, device, blockedUrls, chrome, progress})));
  }
  // Output results, only rendering the summary lines if specified.
  await clearLines(times * devices.length);
  for (i = k = 0, len1 = devices.length; k < len1; i = ++k) {
    device = devices[i];
    console.log(chalk.green.bold(`${ucFirst(device)} Results`));
    if (!summary) {
      console.log(results[i].toString() + "\n");
    } else {
      results[i].splice(0, results[i].length - 2);
      console.log(results[i].toString() + "\n");
    }
  }
  // Close Chrome
  return chrome.kill();
};

// Analyze a URL a certain number of times for the provided device
analyzeUrl = async function({url, times, device, blockedUrls, chrome, progress}) {
  var flags, j, ref, report, results, rows, table, time;
  // Make the lighthouse config
  flags = {
    onlyCategories: ['performance'],
    blockedUrlPatterns: blockedUrls,
    port: chrome.port
  };
  // Run tests one at a time and collect results
  results = [];
  for (time = j = 1, ref = times; (1 <= ref ? j <= ref : j >= ref); time = 1 <= ref ? ++j : --j) {
    ({report} = (await progress(lighthouse(url, flags, configs[device]), `Testing ${ucFirst(device)} ${time}/${times}`, {
      estimate: 10000
    })));
    results.push(JSON.parse(report));
  }
  // Create array with results of each stat
  rows = results.map(function(result) {
    return [result.categories.performance.score, result.audits['first-contentful-paint'].numericValue, result.audits['speed-index'].numericValue, result.audits['largest-contentful-paint'].numericValue, result.audits['interactive'].numericValue, result.audits['total-blocking-time'].numericValue, result.audits['cumulative-layout-shift'].numericValue];
  });
  // Make the table of results
  table = makeTable(rows);
  table = addStats(table, rows);
  return table;
};

// Make the table instance given rows of data
makeTable = function(rows) {
  var columns, index, j, len, row, table;
  columns = ['Score', 'FCP', 'SI', 'LCP', 'TTI', 'TBT', 'CLS'];
  table = new Table({
    head: ['', ...columns],
    style: {
      head: ['green']
    }
  });
  for (index = j = 0, len = rows.length; j < len; index = ++j) {
    row = rows[index];
    // Loop through rows and add formatted row to table
    table.push({
      [`#${index + 1}`]: formatRow(row)
    });
  }
  return table;
};

// Add stats to the table
addStats = function(table, rows) {
  var cols, data, func, j, k, label, len, len1, ref, row, stat, statIndex, val;
  // Make an 2 dimensionsal array where the outer array contains arrays or values
  // for eachs stat
  data = [];
  for (j = 0, len = rows.length; j < len; j++) {
    row = rows[j];
    for (statIndex = k = 0, len1 = row.length; k < len1; statIndex = ++k) {
      val = row[statIndex];
      if (!data[statIndex]) {
        data[statIndex] = [];
      }
      data[statIndex].push(val);
    }
  }
  ref = {
    mean: 'AVG',
    stdev: 'SD'
  };
  // Calculate stats and add to table
  for (func in ref) {
    label = ref[func];
    stat = data.map(function(vals) {
      return stats[func](vals);
    });
    cols = formatRow(stat).map(function(val) {
      return chalk.bold(val);
    });
    table.push({
      [chalk.bold(label)]: cols
    });
  }
  return table;
};

// Helper function to format a row of table output for human readibility
formatRow = function(row) {
  var cls, fcp, lcp, score, si, tbt, tti;
  [score, fcp, si, lcp, tti, tbt, cls] = row;
  return [formatValue(score * 100), formatTime(fcp), formatTime(si), formatTime(lcp), formatTime(tti), formatTime(tbt), formatValue(cls, 3)];
};

// Clear the progress lines before showing output
clearLines = function(lines) {
  return new Promise(function(resolve) {
    return readline.moveCursor(process.stdout, 0, -1 - lines, function() {
      return readline.clearScreenDown(process.stdout, function() {
        return resolve();
      });
    });
  });
};

// Convert ms to s
formatTime = function(ms) {
  if (ms >= 1000) {
    return formatValue(ms / 1000) + 's';
  } else {
    return Math.round(ms) + 'ms';
  }
};

// Round to a decimal value
formatValue = function(num, depth = 1) {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: depth
  });
};

// Capitalize first letter
ucFirst = function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
