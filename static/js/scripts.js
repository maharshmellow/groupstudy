// Socket Connections
var socket = null;
// $(document).ready(function() {

// request permission on page load
document.addEventListener('DOMContentLoaded', function() {
    if (Notification.permission !== "granted")
        Notification.requestPermission();
});

// Use a "/process" namespace.
// An application can open a connection on multiple namespaces, and
// Socket.IO will multiplex all those connections on a single
// physical channel. If you don't care about multiple channels, you
// can set the namespace to an empty string.
namespace = '/process';

// Connect to the Socket.IO server.
// The connection URL has the following format:
//     http[s]://<domain>:<port>[/<namespace>]
socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);

// responses
socket.on('response', function(msg) {
    // TODO convert this to a proper disconnect_response

    if (msg.data == "connect") {
        // update the invite link with the room number
        document.getElementById("inviteLink").innerHTML = location.protocol + '//' + document.domain + '/' + msg.room;
        console.log("Invite Link: ", document.getElementById("inviteLink").innerHTML);
    } else if (msg.data == "disconnect") {
        // update the online member count
        updateMembersConnected(getMembersConnected() - 1);
    }

    console.log(msg.data);
});

socket.on("sync_time_request", function() {
    // called when another user is requesting the timer time

    updateMembersConnected(getMembersConnected() + 1);
    socket.emit('sync_time_event', {
        time: getTimerValue(),
        paused: isPaused(),
        session: current_session,
        type: "sync",
        count: getMembersConnected()
    });
    displayNotification("New User Joined", "A new member has joined the group!");


});

socket.on('sync_time_response', function(msg) {
    // called when the current time is being received
    setTimerValue(msg.time, msg.paused);
    current_session = msg.session;
    updateMembersConnected(msg.count);
    toggleMusic(isBreak(), msg.paused);

    if (!notifications) {
        notifications = true;
        return;
    }

    if (msg.type == "reset") {
        displayNotification("RESET", "A group member has reset the timer.");
    } else if (msg.type == "break") {

        if (current_session % 2 == 0) {
            // study session
            displayNotification("STUDY", "A group member has started the study session.");
        } else {
            displayNotification("BREAK", "A group member has started the break session.");
        }
    }
    notifications = true;


});

socket.on('playtoggle_response', function(msg) {
    toggleTimer();
    console.log("Pause");
    toggleMusic(isBreak(), !isPaused());

    if (isPaused()) {
        // toggleMusic(isBreak(), true);
        document.getElementById("startButton").innerText = "START";
        if (notifications) {
            displayNotification("Paused", "A group member has paused the timer.");
        }
    } else {
        // toggleMusic(isBreak(), false);
        document.getElementById("startButton").innerText = "PAUSE";
        if (notifications) {
            displayNotification("Resume", "A group member has resumed the timer.");
        }
    }

    // the notification were disabled before the request was emitted so that the would not appear for this user
    notifications = true;

});
// emit
$('form#playtoggle').submit(function(event) {
    toggleMusic(isBreak(), isPaused());

    if (pause) {
        document.getElementById("startButton").innerText = "START";
    } else {
        document.getElementById("startButton").innerText = "PAUSE";
    }

    notifications = false; // don't want this client to receive a notification for this - will be turned on later
    socket.emit('playtoggle_event', {
        room: ""
    });
    return false;
});
$('form#resetButton').submit(function(event) {
    notifications = false; // don't want this client to receive a notification for this - will be turned on later
    // tell all connected clients to increase their time by 5 minutes
    socket.emit('sync_time_event', {
        time: sessions[current_session],
        paused: isPaused(),
        session: current_session,
        type: "reset",
        count: getMembersConnected()
    });
    return false;

});
$('form#breakToggle').submit(function(event) {
    notifications = false; // don't want to receive a notification for this - will be turned on later
    toggleTimer(!isBreak(), isPaused());
    // start the next session (could be a break or a study session)
    // current_session = ;
    socket.emit('sync_time_event', {
        time: sessions[(current_session + 1) % 8],
        paused: isPaused(),
        session: (current_session + 1) % 8,
        type: "break",
        count: getMembersConnected()
    });
    return false;

});


// timer


var sessions = [15000, 3000, 15000, 3000, 15000, 3000, 15000, 9000]; // [study, break, study, break ...]
var current_session = 0;

var pause = true;
var pause_time = sessions[0];

var notifications = true;
var members_connected = 1;
var study_sessions_completed = 0;

var element, endTime, hours, mins, msLeft, time;

function countdown(elementName, milliseconds) {
    function twoDigits(n) {
        return (n <= 9 ? "0" + n : n);
    }

    function updateTimer() {
        // if the timer is paused then don't do any updates to the time
        if (pause) {
            return 1;
        }
        msLeft = endTime - (+new Date);

        if (msLeft < 0) {
            current_session = (current_session + 1) % 8;
            // break and study notifications
            if (current_session % 2 == 0) {
                // study session
                // unmuteAll();
                toggleMusic(false, false);
                displayNotification("STUDY", "Time to study!");

            } else {
                toggleMusic(true, false);
                displayNotification("BREAK", "Time for a break!");
                study_sessions_completed += 1;
                document.getElementById("study_session_counter").innerHTML = study_sessions_completed;
            }
            setTimerValue(sessions[current_session], false);

        } else {
            time = new Date(msLeft);
            hours = time.getUTCHours();
            mins = time.getUTCMinutes();
            element.innerHTML = (hours ? hours + ':' + twoDigits(mins) : mins) + ':' + twoDigits(time.getUTCSeconds());
            setTimeout(updateTimer, time.getUTCMilliseconds() + 500);
        }
    }
    element = document.getElementById(elementName);
    endTime = (+new Date) + milliseconds + 500;
    updateTimer();

}

function getTimerValue() {
    if (!msLeft) {
        return (sessions[current_session])
    }
    return (msLeft);
}

function setTimerValue(time_left, paused) {
    pause = false;
    document.getElementById("startButton").innerText = "PAUSE";
    countdown("countdown", time_left);
    if (paused) {
        document.getElementById("startButton").innerText = "START";
        pause = true;
        pause_time = time_left;
    }


    // if (paused() && !isBreak()){
    //     console.log("unmute");
    //     unmuteAll();
    // }
    // else{
    //     console.log("mute");
    //     muteAll();
    // }

}

function toggleTimer() {
    if (pause) {
        pause = false;
        if (pause_time == sessions[current_session]) {
            // if this is the first play of the sesssion - don't want to skip 500 ms
            countdown("countdown", pause_time);
        } else {
            // need to skip 500ms to keep it accurate when doing pause/play really quick
            countdown("countdown", pause_time - 500);
        }
    } else {
        // pause
        pause = true;
        pause_time = getTimerValue();
    }
}

function isPaused() {
    return pause;
}

function isBreak(){
    if (current_session % 2 == 0) {
        return false;
    }
    return true;
}


function displayNotification(title, body) {
    if (!Notification) {
        alert('Desktop notifications not available in your browser. Try Chromium.');
        return;
    }

    if (Notification.permission !== "granted")
        Notification.requestPermission();
    else {
        var notification = new Notification(title, {
            icon: 'http://cdn.sstatic.net/stackexchange/img/logos/so/so-icon.png',
            body: body,
        });

    }
}

function getMembersConnected() {
    return members_connected;
}

function updateMembersConnected(count) {
    members_connected = count;
    document.getElementById("members_online_counter").innerHTML = members_connected;
}

function copyInviteLink(elementId) {
    var aux = document.createElement("input");
    aux.setAttribute("value", document.getElementById(elementId).innerHTML);
    document.body.appendChild(aux);
    aux.select();
    document.execCommand("copy");
    document.body.removeChild(aux);

    // change the text of the button
    document.getElementById("inviteButton").innerText = "COPIED TO CLIPBOARD";

    setInterval(function() {
        //set the inner html, parse the value from the inner html as well
        document.getElementById("inviteButton").innerText = "INVITE";
    }, 3000);
}


// music
var audio_sources = ["audio_rain"];
var muted = false;


function muteAll() {
    for (source in audio_sources) {
        var a = document.getElementById(audio_sources[source]);
        // document.getElementById(audio_sources[source]).pause();
        $(a).animate({
            volume: 0
        }, 1000);
    }
};

function unmuteAll() {
    for (source in audio_sources) {
        // document.getElementById(audio_sources[source]).play();
        var a = document.getElementById(audio_sources[source]);
        $(a).animate({
            volume: 1
        }, 1000);
    }
};


function toggleMusic(isBreak, isPaused){
    if (!isBreak && !isPaused){
        unmuteAll();
    }
    else{
        muteAll();
    }
}

// muteAll();

toggleMusic(isBreak(), isPaused());
