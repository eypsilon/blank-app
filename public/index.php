<?php

use Many\App\App;

require dirname(__DIR__) . '/vendor/autoload.php';

header('content-type: text/plain');

print json_encode([
    'date'     => date('d.m.Y H:i:s'),
    'app'      => App::APP_NAME,
    'php'      => PHP_VERSION,
    'file'     => __FILE__,
    'realpath' => realpath('.'),
]);
