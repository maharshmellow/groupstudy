// convert the invite url to an absolute link
document.getElementById("inviteLink").innerHTML = location.protocol + '//' + document.domain + '/r/' + document.getElementById("inviteLink").innerHTML;


// request notification permission on page load
document.addEventListener('DOMContentLoaded', function() {
    if(Notification.permission !== "granted")
        Notification.requestPermission();
});

// Socket Connections
function init_socket_connection() {
    namespace = '/process';
    socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);

    // responses
    socket.on('response', response_handler);
    socket.on("sync_time_request", sync_time_request_handler);
    socket.on('sync_time_response', sync_time_response_handler);
    socket.on('playtoggle_response', playtoggle_response_handler);
}

function response_handler(msg) {
    if(msg.data == "disconnect") {
        // update the online member count
        updateMembersConnected(getMembersConnected() - 1);

    }
    console.log(msg);
}

function sync_time_request_handler(msg) {
    updateMembersConnected(getMembersConnected() + 1);
    socket.emit('sync_time_event', {
        time: getTimerValue(),
        paused: isPaused(),
        session: current_session,
        type: "sync",
        count: getMembersConnected()
    });
    displayNotification("New User Joined", "A new member has joined the group!");
}

function sync_time_response_handler(msg) {
    // called when the current time is being received
    setTimerValue(msg.time, msg.paused);
    current_session = msg.session;
    updateMembersConnected(msg.count);
    toggleMusic(isBreak(), msg.paused, false);

    if(isBreak()) {
        document.getElementById("startButton").style.backgroundColor = "#170420";
    } else {
        document.getElementById("startButton").style.backgroundColor = "#E71D4A";
    }

    if(!notifications) {
        notifications = true;
        return;
    }

    if(msg.type == "break") {
        if(current_session % 2 == 0) {
            // study session
            displayNotification("STUDY", "A group member has started the study session.");
        } else {
            displayNotification("BREAK", "A group member has started the break session.");
        }
    }
    notifications = true;
}

function playtoggle_response_handler(msg) {
    toggleTimer();
    console.log("Pause");
    toggleMusic(isBreak(), msg.pause, false);

    if(msg.pause) {
        document.getElementById("startButton").innerText = "START";
        if(notifications) {
            displayNotification("Paused", "A group member has paused the timer.");
        }
    } else {
        document.getElementById("startButton").innerText = "PAUSE";
        if(notifications) {
            displayNotification("Resume", "A group member has resumed the timer.");
        }
    }
    // the notification were disabled before the request was emitted so that the would not appear for this user
    notifications = true;
}


// emit
$('form#playtoggle').submit(function(event) {
    notifications = false; // don't want this client to receive a notification for this - will be turned on later

    if(!socket) {
        playtoggle_response_handler({
            pause: !isPaused()
        });
        return false;
    }

    toggleMusic(isBreak(), !isPaused(), false);

    if(pause) {
        document.getElementById("startButton").innerText = "START";
    } else {
        document.getElementById("startButton").innerText = "PAUSE";
    }

    socket.emit('playtoggle_event', {
        pause: !isPaused()
    });
    return false;
});
$('form#muteToggle').submit(function(event) {
    if(muted) {
        unmute(1);
        document.getElementById("muteButton").innerText = "MUTE";
    } else {
        mute();
        document.getElementById("muteButton").innerText = "UNMUTE";
    }

    return false;

});
$('form#breakToggle').submit(function(event) {
    notifications = false; // don't want to receive a notification for this - will be turned on later
    // start the next session (could be a break or a study session)
    current_session = (current_session + 1) % 8;

    if(!socket) {
        sync_time_response_handler({
            time: sessions[current_session],
            paused: isPaused(),
            session: current_session,
            type: "break",
            count: getMembersConnected()
        });
        return false;
    }

    toggleMusic(isBreak(), isPaused(), false);

    socket.emit('sync_time_event', {
        time: sessions[current_session],
        paused: isPaused(),
        session: current_session,
        type: "break",
        count: getMembersConnected()
    });
    return false;

});

var socket = false;

// start a socket connection if the url contains a room number
if($(location).attr('pathname') != "/") {
    init_socket_connection();
}

// timer
var sessions = [1500000, 300000, 1500000, 300000, 1500000, 300000, 1500000, 900000]; // [study, break, study, break ...]
var current_session = 0;

var pause = true;
var pause_time = sessions[0];

var notifications = true;
var members_connected = 1;
var study_sessions_completed = 0;

var element, endTime, hours, mins, msLeft, time;

function countdown(elementName, milliseconds) {
    function twoDigits(n) {
        return(n <= 9 ? "0" + n : n);
    }

    function updateTimer() {
        // if the timer is paused then don't do any updates to the time
        if(pause) {
            return 1;
        }
        msLeft = endTime - (+new Date);

        if(msLeft < 0) {
            current_session = (current_session + 1) % 8;
            if(current_session % 2 == 0) {
                // study session
                toggleMusic(false, false, true);
                displayNotification("STUDY", "Time to study!");

            } else {
                // break session
                toggleMusic(true, false, true);
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
    if(!msLeft) {
        return(sessions[current_session])
    }
    return(msLeft);
}

function setTimerValue(time_left, paused) {
    pause = false;
    document.getElementById("startButton").innerText = "PAUSE";
    countdown("countdown", time_left);
    if(paused) {
        document.getElementById("startButton").innerText = "START";
        pause = true;
        pause_time = time_left;
    }

    if(isBreak()) {
        document.getElementById("startButton").style.backgroundColor = "#170420";
    } else {
        document.getElementById("startButton").style.backgroundColor = "#E71D4A";
    }
}

function toggleTimer() {
    if(pause) {
        pause = false;
        if(pause_time == sessions[current_session]) {
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

function isBreak() {
    if(current_session % 2 == 0) {
        return false;
    }
    return true;
}

function displayNotification(title, body) {
    if(!Notification) {
        alert('Desktop notifications not available in your browser. Try Chromium.');
        return;
    }

    if(Notification.permission !== "granted")
        Notification.requestPermission();
    else {
        var notification = new Notification(title, {
            icon: '../static/images/notification_image.png',
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
    if(!socket) {
        // if the person hasn't invited anyone yet, then there won't be a socket connection
        init_socket_connection();
    }

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
var audio_sources = {
    "rain": 1,
    "thunderstorm": 0.4,
    "fan": 0.3,
    "whitenoise": 0.05
};

function toggleMusic(isBreak, isPaused, fade) {
    // pauses or plays the music
    console.log(isBreak, isPaused, fade);

    for(source in audio_sources) {
        console.log(source, audio_sources[source]);
        var a = document.getElementById(source);

        if(!isBreak && !isPaused) {
            // play the music
            a.currentTime = 0;
            if(fade) {
                $(a).animate({
                    volume: audio_sources[source]
                }, 1000);
            } else {
                a.volume = audio_sources[source];
            }
        } else {
            // pause the music
            if(fade) {
                $(a).animate({
                    volume: 0
                }, 1000);
            } else {
                a.volume = 0;
            }
        }
    }
}

var muted = false;

function mute() {
    muted = true;
    for(source in audio_sources) {
        var a = document.getElementById(source);
        a.pause();
    }
}

function unmute(volume) {
    muted = false;
    for(source in audio_sources) {
        var a = document.getElementById(source);

        if(isBreak() || isPaused()) {
            a.volume = 0;
        } else {
            a.volume = audio_sources[source];
        }

        a.play();
    }
}

// at the start of the program, volume = 0
// it is "playing" in the background so that when the mute button is toggled, we make the volume 1 so that it starts instantly instead of having to load
unmute(0);
