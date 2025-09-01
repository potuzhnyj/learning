function fibonacciGenerator(n) {
  var sequence = [];
  var fibonacci;

  if (n === 0) {
    return sequence;
  } else if (n === 1) {
    sequence.push(0);
    return sequence;
  } else {
    sequence.push(0);
    sequence.push(1);
    for (var i = 3; i <= n; i++) {
      fibonacci = sequence[sequence.length - 1] + sequence[sequence.length - 2];
      sequence.push(fibonacci);
    }
    console.log(sequence);
    return sequence;
  }
}

fibonacciGenerator(9);
