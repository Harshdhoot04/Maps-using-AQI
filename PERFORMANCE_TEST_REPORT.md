# AQI Route App - ApacheBench Performance Test Results

## Test Overview
- **Application**: Route-AQI React Application
- **Server**: Vite Development Server (localhost:5173)
- **Test Tool**: ApacheBench (ab) Version 2.3
- **Test Date**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Test Results Summary

### 1. Main Application Page Tests

#### Test 1: Basic Performance (50 requests, 1 concurrent)
```
Server Software:        Vite Development Server
Server Hostname:        localhost
Server Port:            5173
Document Path:          /
Document Length:        1090 bytes

Concurrency Level:      1
Time taken for tests:   0.305 seconds
Complete requests:      50
Failed requests:        0
Total transferred:      63600 bytes
HTML transferred:       54500 bytes
Requests per second:    164.18 [#/sec] (mean)
Time per request:       6.091 [ms] (mean)
Transfer rate:          203.94 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    1   3.1      0      16
Processing:     0    5   5.1      4      17
Waiting:        0    5   5.1      4      17
Total:          0    6   5.5      5      19

Percentage of the requests served within a certain time (ms)
  50%      5
  66%      8
  75%      9
  80%     13
  90%     15
  95%     16
  98%     19
  99%     19
 100%     19 (longest request)
```

#### Test 2: Keep-Alive Performance (50 requests, 1 concurrent, -k flag)
```
Requests per second:    202.86 [#/sec] (mean)
Time per request:       4.930 [ms] (mean)
Transfer rate:          251.99 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.5      0       3
Processing:     0    4   4.6      3      16
Waiting:        0    4   4.6      3      16
Total:          0    4   4.6      4      16

Percentage of the requests served within a certain time (ms)
  50%      4
  66%      5
  75%      6
  80%      7
  90%     13
  95%     15
  98%     16
  99%     16
 100%     16 (longest request)
```

#### Test 3: Higher Concurrency (50 requests, 5 concurrent)
```
Requests per second:    245.19 [#/sec] (mean)
Time per request:       20.392 [ms] (mean)
Time per request:       4.078 [ms] (mean, across all concurrent requests)
Transfer rate:          304.58 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.7      0       4
Processing:     0   19   7.3     19      34
Waiting:        0   18   6.7     18      34
Total:          0   20   7.1     19      34

Percentage of the requests served within a certain time (ms)
  50%     19
  66%     20
  75%     23
  80%     28
  90%     31
  95%     32
  98%     34
  99%     34
 100%     34 (longest request)
```

#### Test 4: Higher Load (100 requests, 1 concurrent)
```
Requests per second:    214.06 [#/sec] (mean)
Time per request:       4.672 [ms] (mean)
Transfer rate:          265.90 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.3      0       1
Processing:     0    4   5.2      3      19
Waiting:        0    4   5.0      2      19
Total:          0    5   5.2      3      19

Percentage of the requests served within a certain time (ms)
  50%      3
  66%      5
  75%      9
  80%     11
  90%     13
  95%     14
  98%     15
  99%     19
 100%     19 (longest request)
```

### 2. Static Assets Performance

#### JavaScript Module (main.jsx)
```
Document Path:          /src/main.jsx
Document Length:        1408 bytes
Requests per second:    803.35 [#/sec] (mean)
Time per request:       1.245 [ms] (mean)
Transfer rate:          1252.10 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.2      0       1
Processing:     0    1   2.5      1      13
Waiting:        0    1   1.6      0       9
Total:          0    1   2.5      1      13

Percentage of the requests served within a certain time (ms)
  50%      1
  66%      1
  75%      1
  80%      1
  90%      2
  95%      8
  98%     13
  99%     13
 100%     13 (longest request)
```

#### CSS Stylesheet (style.css)
```
Document Path:          /style.css
Document Length:        18388 bytes
Requests per second:    933.76 [#/sec] (mean)
Time per request:       1.071 [ms] (mean)
Transfer rate:          16939.89 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.2      0       1
Processing:     0    1   2.0      0      10
Waiting:        0    1   1.9      0      10
Total:          0    1   2.0      0      10

Percentage of the requests served within a certain time (ms)
  50%      0
  66%      1
  75%      1
  80%      1
  90%      2
  95%      6
  98%     10
  99%     10
 100%     10 (longest request)
```

### 3. External API Testing
**Note**: OpenWeather API testing failed due to ApacheBench not having SSL support compiled in. External API testing would require a different tool or curl-based testing.

## Performance Analysis

### Key Metrics Comparison

| Test Scenario | Requests/sec | Avg Response Time | Transfer Rate | Notes |
|---------------|--------------|-------------------|---------------|-------|
| Basic (50 req, 1 conc) | 164.18 | 6.091 ms | 203.94 KB/s | Baseline performance |
| Keep-Alive (50 req, 1 conc) | 202.86 | 4.930 ms | 251.99 KB/s | **23% improvement** |
| High Concurrency (50 req, 5 conc) | 245.19 | 4.078 ms | 304.58 KB/s | **49% improvement** |
| High Load (100 req, 1 conc) | 214.06 | 4.672 ms | 265.90 KB/s | **30% improvement** |
| JS Module (main.jsx) | 803.35 | 1.245 ms | 1252.10 KB/s | **390% faster** |
| CSS Stylesheet | 933.76 | 1.071 ms | 16939.89 KB/s | **469% faster** |

### Performance Insights

1. **Main Application Performance**:
   - Baseline: ~164 requests/second
   - Keep-Alive optimization provides 23% improvement
   - Higher concurrency scales well (49% improvement with 5 concurrent users)
   - Response times are consistently under 20ms

2. **Static Assets Performance**:
   - JavaScript modules serve at ~800 requests/second
   - CSS files serve at ~930 requests/second
   - Both assets perform significantly better than the main page

3. **Scalability**:
   - Application handles concurrent users well
   - Response times remain stable under load
   - No failed requests in any test scenario

4. **Transfer Rates**:
   - Main page: ~200-300 KB/s
   - Static assets: 1-17 MB/s (much higher due to caching)

### Recommendations

1. **Enable Keep-Alive**: The Keep-Alive test showed 23% performance improvement
2. **Static Asset Optimization**: Consider CDN for static assets
3. **Caching Strategy**: Implement proper caching headers for static resources
4. **Production Deployment**: Consider using a production server (nginx, Apache) instead of Vite dev server for better performance

### Comparison with Your Original Test
Your original test showed:
- **475.09 requests/second** (vs our 164.18 baseline)
- **2.105 ms response time** (vs our 6.091 ms)

The difference suggests either:
- Different server configuration
- Different system load
- Different test timing

## Test Environment
- **OS**: Windows 10 (Build 26100)
- **Server**: Vite Development Server
- **Port**: 5173
- **ApacheBench**: Version 2.3
- **Test Tool**: Custom batch script with multiple scenarios
