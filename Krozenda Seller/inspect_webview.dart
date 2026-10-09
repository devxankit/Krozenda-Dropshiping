import 'dart:mirrors';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

void main() {
  var classMirror = reflectClass(InAppWebView);
  var constructors = classMirror.declarations.values.whereType<MethodMirror>().where((m) => m.isConstructor);
  for (var c in constructors) {
    print("Constructor: ${c.simpleName}");
    for (var p in c.parameters) {
      print("  Param: ${MirrorSystem.getName(p.simpleName)}");
    }
  }
}
