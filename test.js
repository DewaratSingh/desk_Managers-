import http from 'k6/http';

export const options = {
  vus: 1000,
  duration: '30s',
};

export default function () {
  http.get('http://192.168.1.120:5000/');
}