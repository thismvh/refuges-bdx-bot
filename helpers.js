function capitalise(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}

function arrayIsEqual(array1, array2) {
    if (array1 === array2) return true;
    if (array1 == null || array2 == null) return false;
    if(array1.length !== array2.length) return false

    return array1.every((element, index) => array2.includes(element));
}

async function delay(time) {
    await new Promise(resolve => setTimeout(resolve, time));
}

function splitDateString(string) {
    return string.split(",").map(date => {
        var dateFormat = date.match(/(\d?\d)\.(\d?\d).?(\d{4})?/)
        return { day: dateFormat[1], month: dateFormat[2], year: dateFormat[3] }
      })[0]
}

module.exports = {
    capitalise,
    arrayIsEqual,
    delay,
    splitDateString
}